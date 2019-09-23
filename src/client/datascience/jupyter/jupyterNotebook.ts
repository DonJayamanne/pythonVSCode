// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import * as uuid from 'uuid/v4';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { ILiveShareApi } from '../../common/application/types';
import { Cancellation, CancellationError } from '../../common/cancellation';
import { traceError, traceInfo, traceWarning } from '../../common/logger';
import { IConfigurationService, IDisposableRegistry } from '../../common/types';
import { createDeferred, Deferred, waitForPromise } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { noop } from '../../common/utils/misc';
import { StopWatch } from '../../common/utils/stopWatch';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { generateCells } from '../cellFactory';
import { CellMatcher } from '../cellMatcher';
import { concatMultilineString, formatStreamText } from '../common';
import { CodeSnippits, Identifiers, Telemetry } from '../constants';
import {
    CellState,
    ICell,
    IJupyterSession,
    INotebook,
    INotebookCompletion,
    INotebookExecutionLogger,
    INotebookServer,
    INotebookServerLaunchInfo,
    InterruptResult
} from '../types';

class CellSubscriber {
    private deferred: Deferred<CellState> = createDeferred<CellState>();
    private cellRef: ICell;
    private subscriber: Subscriber<ICell>;
    private promiseComplete: (self: CellSubscriber) => void;
    private canceledEvent: EventEmitter<void> = new EventEmitter<void>();
    private _startTime: number;

    constructor(cell: ICell, subscriber: Subscriber<ICell>, promiseComplete: (self: CellSubscriber) => void) {
        this.cellRef = cell;
        this.subscriber = subscriber;
        this.promiseComplete = promiseComplete;
        this._startTime = Date.now();
    }

    public get startTime(): number {
        return this._startTime;
    }

    public get onCanceled(): Event<void> {
        return this.canceledEvent.event;
    }

    public isValid(sessionStartTime: number | undefined) {
        return sessionStartTime && this.startTime >= sessionStartTime;
    }

    public next(sessionStartTime: number | undefined) {
        // Tell the subscriber first
        if (this.isValid(sessionStartTime)) {
            this.subscriber.next(this.cellRef);
        }

        // Then see if we're finished or not.
        this.attemptToFinish();
    }

    // tslint:disable-next-line:no-any
    public error(sessionStartTime: number | undefined, err: any) {
        if (this.isValid(sessionStartTime)) {
            this.subscriber.error(err);
        }
    }

    public complete(sessionStartTime: number | undefined) {
        if (this.isValid(sessionStartTime)) {
            this.subscriber.next(this.cellRef);
        }
        this.subscriber.complete();

        // Then see if we're finished or not.
        this.attemptToFinish();
    }

    // tslint:disable-next-line:no-any
    public reject(e: any) {
        if (!this.deferred.completed) {
            this.cellRef.state = CellState.error;
            this.subscriber.next(this.cellRef);
            this.subscriber.complete();
            this.deferred.reject(e);
            this.promiseComplete(this);
        }
    }

    public cancel() {
        this.canceledEvent.fire();
        if (!this.deferred.completed) {
            this.cellRef.state = CellState.error;
            this.subscriber.next(this.cellRef);
            this.subscriber.complete();
            this.deferred.resolve();
            this.promiseComplete(this);
        }
    }

    public get promise(): Promise<CellState> {
        return this.deferred.promise;
    }

    public get cell(): ICell {
        return this.cellRef;
    }

    private attemptToFinish() {
        if ((!this.deferred.completed) &&
            (this.cell.state === CellState.finished || this.cell.state === CellState.error)) {
            this.deferred.resolve(this.cell.state);
            this.promiseComplete(this);
        }
    }
}

// This code is based on the examples here:
// https://www.npmjs.com/package/@jupyterlab/services

export class JupyterNotebookBase implements INotebook {
    private sessionStartTime: number;
    private pendingCellSubscriptions: CellSubscriber[] = [];
    private ranInitialSetup = false;
    private _resource: Uri;
    private _disposed: boolean = false;

    constructor(
        _liveShare: ILiveShareApi, // This is so the liveshare mixin works
        private session: IJupyterSession,
        private configService: IConfigurationService,
        private disposableRegistry: IDisposableRegistry,
        private owner: INotebookServer,
        private launchInfo: INotebookServerLaunchInfo,
        private loggers: INotebookExecutionLogger[],
        resource: Uri,
        private getDisposedError: () => Error
    ) {
        this.sessionStartTime = Date.now();
        this._resource = resource;
    }

    public get server(): INotebookServer {
        return this.owner;
    }

    public dispose(): Promise<void> {
        traceInfo(`Shutting down session ${this.resource.toString()}`);
        if (!this._disposed) {
            this._disposed = true;
            const dispose = this.session ? this.session.dispose() : undefined;
            return dispose ? dispose : Promise.resolve();
        }
        return Promise.resolve();
    }

    public get resource(): Uri {
        return this._resource;
    }

    public waitForIdle(timeoutMs: number): Promise<void> {
        return this.session ? this.session.waitForIdle(timeoutMs) : Promise.resolve();
    }

    // Set up our initial plotting and imports
    public async initialize(cancelToken?: CancellationToken): Promise<void> {
        if (this.ranInitialSetup) {
            return;
        }
        this.ranInitialSetup = true;

        try {
            // When we start our notebook initial, change to our workspace or user specified root directory
            if (this.launchInfo && this.launchInfo.workingDir && this.launchInfo.connectionInfo.localLaunch) {
                traceInfo(`Changing directory for ${this.resource.toString()}`);
                await this.changeDirectoryIfPossible(this.launchInfo.workingDir);
            }

            const settings = this.configService.getSettings().datascience;
            const matplobInit = !settings || settings.enablePlotViewer ? CodeSnippits.MatplotLibInitSvg : CodeSnippits.MatplotLibInitPng;

            traceInfo(`Initialize matplotlib for ${this.resource.toString()}`);
            // Force matplotlib to inline and save the default style. We'll use this later if we
            // get a request to update style
            await this.executeSilently(
                matplobInit,
                cancelToken
            );

            // Run any startup commands that we specified. Support the old form too
            const setting = settings.runStartupCommands || settings.runMagicCommands;
            if (setting) {
                // Cleanup the linefeeds. User may have typed them into the settings UI so they will have an extra \\ on the front.
                const cleanedUp = setting.replace(/\\n/g, '\n');
                await this.executeSilently(cleanedUp, cancelToken);
                traceInfo(`Run startup code for notebook: ${cleanedUp}`);
            }

            traceInfo(`Initial setup complete for ${this.resource.toString()}`);
        } catch (e) {
            traceWarning(e);
        }
    }

    public clear(_id: string): void {
        // We don't do anything as we don't cache results in this class.
        noop();
    }

    public execute(code: string, file: string, line: number, id: string, cancelToken?: CancellationToken, silent?: boolean): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook.
        const observable = this.executeObservable(code, file, line, id, silent);
        let output: ICell[];

        observable.subscribe(
            (cells: ICell[]) => {
                output = cells;
            },
            (error) => {
                deferred.reject(error);
            },
            () => {
                deferred.resolve(output);
            });

        if (cancelToken) {
            this.disposableRegistry.push(cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError())));
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    public async setInitialDirectory(directory: string): Promise<void> {
        // If we launched local and have no working directory call this on add code to change directory
        if (this.launchInfo && !this.launchInfo.workingDir && this.launchInfo.connectionInfo.localLaunch) {
            await this.changeDirectoryIfPossible(directory);
            this.launchInfo.workingDir = directory;
        }
    }

    public executeObservable(code: string, file: string, line: number, id: string, silent: boolean = false): Observable<ICell[]> {
        // Create an observable and wrap the result so we can time it.
        const stopWatch = new StopWatch();
        const result = this.executeObservableImpl(code, file, line, id, silent);
        return new Observable<ICell[]>(subscriber => {
            result.subscribe(cells => {
                subscriber.next(cells);
            },
                error => {
                    subscriber.error(error);
                },
                () => {
                    subscriber.complete();
                    sendTelemetryEvent(Telemetry.ExecuteCell, stopWatch.elapsedTime);
                });
        });
    }

    public async getSysInfo(): Promise<ICell> {
        // tslint:disable-next-line:no-multiline-string
        const versionCells = await this.executeSilently(`import sys\r\nsys.version`);
        // tslint:disable-next-line:no-multiline-string
        const pathCells = await this.executeSilently(`import sys\r\nsys.executable`);
        // tslint:disable-next-line:no-multiline-string
        const notebookVersionCells = await this.executeSilently(`import notebook\r\nnotebook.version_info`);

        // Both should have streamed output
        const version = versionCells.length > 0 ? this.extractStreamOutput(versionCells[0]).trimQuotes() : '';
        const notebookVersion = notebookVersionCells.length > 0 ? this.extractStreamOutput(notebookVersionCells[0]).trimQuotes() : '';
        const pythonPath = versionCells.length > 0 ? this.extractStreamOutput(pathCells[0]).trimQuotes() : '';

        // Combine this data together to make our sys info
        return {
            data: {
                cell_type: 'messages',
                messages: [
                    version,
                    notebookVersion,
                    pythonPath
                ],
                metadata: {},
                source: []
            },
            id: uuid(),
            file: '',
            line: 0,
            state: CellState.finished,
            type: 'execute'
        };
    }

    @captureTelemetry(Telemetry.RestartJupyterTime)
    public async restartKernel(timeoutMs: number): Promise<void> {
        if (this.session) {
            // Update our start time so we don't keep sending responses
            this.sessionStartTime = Date.now();

            traceInfo('restartKernel - finishing cells that are outstanding');
            // Complete all pending as an error. We're restarting
            this.finishUncompletedCells();
            traceInfo('restartKernel - restarting kernel');

            // Restart our kernel
            await this.session.restart(timeoutMs);

            // Rerun our initial setup for the notebook
            this.ranInitialSetup = false;
            traceInfo('restartKernel - initialSetup');
            await this.initialize();
            traceInfo('restartKernel - initialSetup completed');

            return;
        }

        throw this.getDisposedError();
    }

    @captureTelemetry(Telemetry.InterruptJupyterTime)
    public async interruptKernel(timeoutMs: number): Promise<InterruptResult> {
        if (this.session) {
            // Keep track of our current time. If our start time gets reset, we
            // restarted the kernel.
            const interruptBeginTime = Date.now();

            // Get just the first pending cell (it should be the oldest). If it doesn't finish
            // by our timeout, then our interrupt didn't work.
            const firstPending = this.pendingCellSubscriptions.length > 0 ? this.pendingCellSubscriptions[0] : undefined;

            // Create a promise that resolves when the first pending cell finishes
            const finished = firstPending ? firstPending.promise : Promise.resolve(CellState.finished);

            // Create a deferred promise that resolves if we have a failure
            const restarted = createDeferred<CellState[]>();

            // Listen to status change events so we can tell if we're restarting
            const restartHandler = () => {
                // We restarted the kernel.
                this.sessionStartTime = Date.now();
                traceWarning('Kernel restarting during interrupt');

                // Indicate we have to redo initial setup. We can't wait for starting though
                // because sometimes it doesn't happen
                this.ranInitialSetup = false;

                // Indicate we restarted the race below
                restarted.resolve([]);

                // Fail all of the active (might be new ones) pending cell executes. We restarted.
                this.finishUncompletedCells();
            };
            const restartHandlerToken = this.session.onRestarted(restartHandler);

            // Start our interrupt. If it fails, indicate a restart
            this.session.interrupt(timeoutMs).catch(exc => {
                traceWarning(`Error during interrupt: ${exc}`);
                restarted.resolve([]);
            });

            try {
                // Wait for all of the pending cells to finish or the timeout to fire
                const result = await waitForPromise(Promise.race([finished, restarted.promise]), timeoutMs);

                // See if we restarted or not
                if (restarted.completed) {
                    return InterruptResult.Restarted;
                }

                if (result === null) {
                    // We timed out. You might think we should stop our pending list, but that's not
                    // up to us. The cells are still executing. The user has to request a restart or try again
                    return InterruptResult.TimedOut;
                }

                // Cancel all other pending cells as we interrupted.
                this.finishUncompletedCells();

                // Indicate the interrupt worked.
                return InterruptResult.Success;

            } catch (exc) {
                // Something failed. See if we restarted or not.
                if (this.sessionStartTime && (interruptBeginTime < this.sessionStartTime)) {
                    return InterruptResult.Restarted;
                }

                // Otherwise a real error occurred.
                throw exc;
            } finally {
                restartHandlerToken.dispose();
            }
        }

        throw this.getDisposedError();
    }

    public async setMatplotLibStyle(useDark: boolean): Promise<void> {
        // Reset the matplotlib style based on if dark or not.
        await this.executeSilently(useDark ?
            'matplotlib.style.use(\'dark_background\')' :
            `matplotlib.rcParams.update(${Identifiers.MatplotLibDefaultParams})`);

    }

    public async getCompletion(cellCode: string, offsetInCode: number, cancelToken?: CancellationToken): Promise<INotebookCompletion> {
        if (this.session) {
            const result = await Cancellation.race(() => this.session!.requestComplete({
                code: cellCode,
                cursor_pos: offsetInCode
            }), cancelToken);
            if (result && result.content) {
                return {
                    matches: result.content.matches,
                    cursor: {
                        start: result.content.cursor_start,
                        end: result.content.cursor_end
                    },
                    metadata: result.content.metadata
                };
            }
        }

        // Default is just say session was disposed
        throw new Error(localize.DataScience.sessionDisposed());
    }

    private finishUncompletedCells() {
        const copyPending = [...this.pendingCellSubscriptions];
        copyPending.forEach(c => c.cancel());
        this.pendingCellSubscriptions = [];
    }

    @captureTelemetry(Telemetry.HiddenCellTime)
    private executeSilently(code: string, cancelToken?: CancellationToken): Promise<ICell[]> {
        // Create a deferred that we'll fire when we're done
        const deferred = createDeferred<ICell[]>();

        // Attempt to evaluate this cell in the jupyter notebook
        const observable = this.executeObservableImpl(code, Identifiers.EmptyFileName, 0, uuid(), true);
        let output: ICell[];

        observable.subscribe(
            (cells: ICell[]) => {
                output = cells;
            },
            (error) => {
                deferred.reject(error);
            },
            () => {
                deferred.resolve(output);
            });

        if (cancelToken) {
            this.disposableRegistry.push(cancelToken.onCancellationRequested(() => deferred.reject(new CancellationError())));
        }

        // Wait for the execution to finish
        return deferred.promise;
    }

    private extractStreamOutput(cell: ICell): string {
        let result = '';
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs) {
                outputs.forEach(o => {
                    if (o.output_type === 'stream') {
                        const stream = o as nbformat.IStream;
                        result = result.concat(formatStreamText(concatMultilineString(stream.text)));
                    } else {
                        const data = o.data;
                        if (data && data.hasOwnProperty('text/plain')) {
                            // tslint:disable-next-line:no-any
                            result = result.concat((data as any)['text/plain']);
                        }
                    }
                });
            }
        }
        return result;
    }

    private executeObservableImpl(code: string, file: string, line: number, id: string, silent?: boolean): Observable<ICell[]> {
        // If we have a session, execute the code now.
        if (this.session) {
            // Generate our cells ahead of time
            const cells = generateCells(this.configService.getSettings().datascience, code, file, line, true, id);

            // Might have more than one (markdown might be split)
            if (cells.length > 1) {
                // We need to combine results
                return this.combineObservables(
                    this.executeMarkdownObservable(cells[0]),
                    this.executeCodeObservable(cells[1], silent));
            } else if (cells.length > 0) {
                // Either markdown or or code
                return this.combineObservables(
                    cells[0].data.cell_type === 'code' ? this.executeCodeObservable(cells[0], silent) : this.executeMarkdownObservable(cells[0]));
            }
        }

        traceError('No session during execute observable');

        // Can't run because no session
        return new Observable<ICell[]>(subscriber => {
            subscriber.error(this.getDisposedError());
            subscriber.complete();
        });
    }

    private generateRequest = (code: string, silent?: boolean): Kernel.IFuture | undefined => {
        //traceInfo(`Executing code in jupyter : ${code}`);
        try {
            const cellMatcher = new CellMatcher(this.configService.getSettings().datascience);
            return this.session ? this.session.requestExecute(
                {
                    // Remove the cell marker if we have one.
                    code: cellMatcher.stripFirstMarker(code),
                    stop_on_error: false,
                    allow_stdin: false,
                    store_history: !silent // Silent actually means don't output anything. Store_history is what affects execution_count
                },
                true
            ) : undefined;
        } catch (exc) {
            // Any errors generating a request should just be logged. User can't do anything about it.
            traceError(exc);
        }

        return undefined;
    }

    private combineObservables = (...args: Observable<ICell>[]): Observable<ICell[]> => {
        return new Observable<ICell[]>(subscriber => {
            // When all complete, we have our results
            const results: Record<string, ICell> = {};

            args.forEach(o => {
                o.subscribe(c => {
                    results[c.id] = c;

                    // Convert to an array
                    const array = Object.keys(results).map((k: string) => {
                        return results[k];
                    });

                    // Update our subscriber of our total results if we have that many
                    if (array.length === args.length) {
                        subscriber.next(array);

                        // Complete when everybody is finished
                        if (array.every(a => a.state === CellState.finished || a.state === CellState.error)) {
                            subscriber.complete();
                        }
                    }
                },
                    e => {
                        subscriber.error(e);
                    });
            });
        });
    }

    private executeMarkdownObservable = (cell: ICell): Observable<ICell> => {
        // Markdown doesn't need any execution
        return new Observable<ICell>(subscriber => {
            subscriber.next(cell);
            subscriber.complete();
        });
    }

    private changeDirectoryIfPossible = async (directory: string): Promise<void> => {
        if (this.launchInfo && this.launchInfo.connectionInfo.localLaunch && await fs.pathExists(directory)) {
            await this.executeSilently(`%cd "${directory}"`);
        }
    }

    // tslint:disable-next-line: max-func-body-length
    private handleCodeRequest = (subscriber: CellSubscriber, silent?: boolean) => {
        // Generate a new request if we still can
        if (subscriber.isValid(this.sessionStartTime)) {

            // Double check process is still running
            if (this.launchInfo && this.launchInfo.connectionInfo && this.launchInfo.connectionInfo.localProcExitCode) {
                // Not running, just exit
                const exitCode = this.launchInfo.connectionInfo.localProcExitCode;
                traceError(`Jupyter crashed with code ${exitCode}`);
                subscriber.error(this.sessionStartTime, new Error(localize.DataScience.jupyterServerCrashed().format(exitCode.toString())));
                subscriber.complete(this.sessionStartTime);
            } else {
                const request = this.generateRequest(concatMultilineString(subscriber.cell.data.source), silent);

                // tslint:disable-next-line:no-require-imports
                const jupyterLab = require('@jupyterlab/services') as typeof import('@jupyterlab/services');

                // Transition to the busy stage
                subscriber.cell.state = CellState.executing;

                // Make sure our connection doesn't go down
                let exitHandlerDisposable: Disposable | undefined;
                if (this.launchInfo && this.launchInfo.connectionInfo) {
                    // If the server crashes, cancel the current observable
                    exitHandlerDisposable = this.launchInfo.connectionInfo.disconnected((c) => {
                        const str = c ? c.toString() : '';
                        // Only do an error if we're not disposed. If we're disposed we already shutdown.
                        if (!this._disposed) {
                            subscriber.error(this.sessionStartTime, new Error(localize.DataScience.jupyterServerCrashed().format(str)));
                        }
                        subscriber.complete(this.sessionStartTime);
                    });
                }

                // Create a trimming function. Only trim user output. Silent output requires the full thing
                const trimFunc = silent ? (s: string) => s : this.trimOutput.bind(this);

                const clearState: Map<string, boolean> = new Map<string, boolean>();

                // Listen to the reponse messages and update state as we go
                if (request) {
                    // Stop handling the request if the subscriber is canceled.
                    subscriber.onCanceled(() => {
                        request.onIOPub = noop;
                    });

                    // Listen to messages.
                    request.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
                        try {
                            if (jupyterLab.KernelMessage.isExecuteResultMsg(msg)) {
                                this.handleExecuteResult(msg as KernelMessage.IExecuteResultMsg, clearState, subscriber.cell, trimFunc);
                            } else if (jupyterLab.KernelMessage.isExecuteInputMsg(msg)) {
                                this.handleExecuteInput(msg as KernelMessage.IExecuteInputMsg, clearState, subscriber.cell);
                            } else if (jupyterLab.KernelMessage.isStatusMsg(msg)) {
                                this.handleStatusMessage(msg as KernelMessage.IStatusMsg, clearState, subscriber.cell);
                            } else if (jupyterLab.KernelMessage.isStreamMsg(msg)) {
                                this.handleStreamMesssage(msg as KernelMessage.IStreamMsg, clearState, subscriber.cell, trimFunc);
                            } else if (jupyterLab.KernelMessage.isDisplayDataMsg(msg)) {
                                this.handleDisplayData(msg as KernelMessage.IDisplayDataMsg, clearState, subscriber.cell);
                            } else if (jupyterLab.KernelMessage.isUpdateDisplayDataMsg(msg)) {
                                this.handleUpdateDisplayData(msg as KernelMessage.IUpdateDisplayDataMsg, clearState, subscriber.cell);
                            } else if (jupyterLab.KernelMessage.isClearOutputMsg(msg)) {
                                this.handleClearOutput(msg as KernelMessage.IClearOutputMsg, clearState, subscriber.cell);
                            } else if (jupyterLab.KernelMessage.isErrorMsg(msg)) {
                                this.handleError(msg as KernelMessage.IErrorMsg, clearState, subscriber.cell);
                            } else {
                                traceWarning(`Unknown message ${msg.header.msg_type} : hasData=${'data' in msg.content}`);
                            }

                            // Set execution count, all messages should have it
                            if (msg.content.execution_count) {
                                subscriber.cell.data.execution_count = msg.content.execution_count as number;
                            }

                            // Show our update if any new output.
                            subscriber.next(this.sessionStartTime);
                        } catch (err) {
                            // If not a restart error, then tell the subscriber
                            subscriber.error(this.sessionStartTime, err);
                        }
                    };

                    // When the request finishes we are done
                    request.done.then(() => {
                        subscriber.complete(this.sessionStartTime);
                        if (exitHandlerDisposable) {
                            exitHandlerDisposable.dispose();
                        }
                    }).catch(e => subscriber.error(this.sessionStartTime, e));
                } else {
                    subscriber.error(this.sessionStartTime, this.getDisposedError());
                }
            }
        } else {
            const sessionDate = new Date(this.sessionStartTime!);
            const cellDate = new Date(subscriber.startTime);
            traceInfo(`Session start time is newer than cell : \r\n${sessionDate.toTimeString()}\r\n${cellDate.toTimeString()}`);

            // Otherwise just set to an error
            this.handleInterrupted(subscriber.cell);
            subscriber.cell.state = CellState.error;
            subscriber.complete(this.sessionStartTime);
        }

    }

    private executeCodeObservable(cell: ICell, silent?: boolean): Observable<ICell> {
        return new Observable<ICell>(subscriber => {
            // Tell our listener. NOTE: have to do this asap so that markdown cells don't get
            // run before our cells.
            subscriber.next(cell);
            const isSilent = silent !== undefined ? silent : false;

            // Wrap the subscriber and save it. It is now pending and waiting completion. Have to do this
            // synchronously so it happens before interruptions.
            const cellSubscriber = new CellSubscriber(cell, subscriber, (self: CellSubscriber) => {
                // Subscriber completed, remove from subscriptions.
                this.pendingCellSubscriptions = this.pendingCellSubscriptions.filter(p => p !== self);

                // Indicate success or failure
                this.logPostCode(cell, isSilent).ignoreErrors();
            });
            this.pendingCellSubscriptions.push(cellSubscriber);

            // Log the pre execution.
            this.logPreCode(cell, isSilent).then(() => {
                // Now send our real request. This should call back on the cellsubscriber when it's done.
                this.handleCodeRequest(cellSubscriber, silent);
            }).ignoreErrors();

        });
    }

    private async logPreCode(cell: ICell, silent: boolean): Promise<void> {
        await Promise.all(this.loggers.map(l => l.preExecute(cell, silent)));
    }

    private async logPostCode(cell: ICell, silent: boolean): Promise<void> {
        await Promise.all(this.loggers.map(l => l.postExecute(cell, silent)));
    }

    private addToCellData = (cell: ICell, output: nbformat.IUnrecognizedOutput | nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError, clearState: Map<string, boolean>) => {
        // If a clear is pending, replace the output with the new one
        if (clearState.get(output.output_type)) {
            clearState.delete(output.output_type);
            const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
            const index = data.outputs.findIndex(o => o.output_type === output.output_type);
            if (index >= 0) {
                data.outputs.splice(index, 1, output);
            } else {
                data.outputs = [...data.outputs, output];
            }
            cell.data = data;
        } else {
            // Then append this data onto the end.
            const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
            data.outputs = [...data.outputs, output];
            cell.data = data;
        }
    }

    private handleExecuteResult(msg: KernelMessage.IExecuteResultMsg, clearState: Map<string, boolean>, cell: ICell, trimFunc: (str: string) => string) {
        // Check our length on text output
        if (msg.content.data && msg.content.data.hasOwnProperty('text/plain')) {
            msg.content.data['text/plain'] = trimFunc(msg.content.data['text/plain'] as string);
        }

        this.addToCellData(
            cell,
            { output_type: 'execute_result', data: msg.content.data, metadata: msg.content.metadata, execution_count: msg.content.execution_count },
            clearState);
    }

    private handleExecuteInput(msg: KernelMessage.IExecuteInputMsg, _clearState: Map<string, boolean>, cell: ICell) {
        cell.data.execution_count = msg.content.execution_count;
    }

    private handleStatusMessage(msg: KernelMessage.IStatusMsg, _clearState: Map<string, boolean>, cell: ICell) {
        // Status change to idle generally means we finished. Not sure how to
        // make sure of this. Maybe only bother if an interrupt
        if (msg.content.execution_state === 'idle' && cell.state !== CellState.error) {
            cell.state = CellState.finished;
        }
    }

    private handleStreamMesssage(msg: KernelMessage.IStreamMsg, clearState: Map<string, boolean>, cell: ICell, trimFunc: (str: string) => string) {
        // Might already have a stream message. If so, just add on to it.
        const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
        const existing = data.outputs.find(o => o.output_type === 'stream');
        if (existing) {
            // If clear pending, then don't add.
            if (clearState.get('stream')) {
                clearState.delete('stream');
                existing.text = msg.content.text;
            } else {
                // tslint:disable-next-line:restrict-plus-operands
                existing.text = existing.text + msg.content.text;
                existing.text = trimFunc(formatStreamText(concatMultilineString(existing.text)));
            }

        } else {
            // Create a new stream entry
            const output: nbformat.IStream = {
                output_type: 'stream',
                name: msg.content.name,
                text: trimFunc(formatStreamText(concatMultilineString(msg.content.text)))
            };
            this.addToCellData(cell, output, clearState);
        }
    }

    private handleDisplayData(msg: KernelMessage.IDisplayDataMsg, clearState: Map<string, boolean>, cell: ICell) {
        const output: nbformat.IDisplayData = {
            output_type: 'display_data',
            data: msg.content.data,
            metadata: msg.content.metadata
        };
        this.addToCellData(cell, output, clearState);
    }

    private handleUpdateDisplayData(msg: KernelMessage.IUpdateDisplayDataMsg, _clearState: Map<string, boolean>, cell: ICell) {
        // Should already have a display data output in our cell.
        const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
        const output = data.outputs.find(o => o.output_type === 'display_data');
        if (output) {
            output.data = msg.content.data;
            output.metadata = msg.content.metadata;
        }
    }

    private handleClearOutput(msg: KernelMessage.IClearOutputMsg, clearState: Map<string, boolean>, cell: ICell) {
        // If the message says wait, add every message type to our clear state. This will
        // make us wait for this type of output before we clear it.
        if (msg && msg.content.wait) {
            clearState.set('display_data', true);
            clearState.set('error', true);
            clearState.set('execute_result', true);
            clearState.set('stream', true);
        } else {
            // Clear all outputs and start over again.
            const data: nbformat.ICodeCell = cell.data as nbformat.ICodeCell;
            data.outputs = [];
        }
    }

    private handleInterrupted(cell: ICell) {
        this.handleError({
            channel: 'iopub',
            parent_header: {},
            metadata: {},
            header: { username: '', version: '', session: '', msg_id: '', msg_type: 'error' },
            content: {
                ename: 'KeyboardInterrupt',
                evalue: '',
                // Does this need to be translated? All depends upon if jupyter does or not
                traceback: [
                    '[1;31m---------------------------------------------------------------------------[0m',
                    '[1;31mKeyboardInterrupt[0m: '
                ]
            }
        }, new Map<string, boolean>(), cell);
    }

    private handleError(msg: KernelMessage.IErrorMsg, clearState: Map<string, boolean>, cell: ICell) {
        const output: nbformat.IError = {
            output_type: 'error',
            ename: msg.content.ename,
            evalue: msg.content.evalue,
            traceback: msg.content.traceback
        };
        this.addToCellData(cell, output, clearState);
        cell.state = CellState.error;

        // In the error scenario, we want to stop all other pending cells.
        if (this.configService.getSettings().datascience.stopOnError) {
            this.pendingCellSubscriptions.forEach(c => {
                if (c.cell.id !== cell.id) {
                    c.cancel();
                }
            });
        }
    }

    // We have a set limit for the number of output text characters that we display by default
    // trim down strings to that limit, assuming at this point we have compressed down to a single string
    private trimOutput(outputString: string): string {
        const outputLimit = this.configService.getSettings().datascience.textOutputLimit;

        if (!outputLimit || outputLimit === 0 || outputString.length <= outputLimit) {
            return outputString;
        }

        return outputString.substr(outputString.length - outputLimit);
    }
}
