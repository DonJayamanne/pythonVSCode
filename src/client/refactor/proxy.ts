// tslint:disable:no-any no-empty member-ordering prefer-const prefer-template no-var-self

import { ChildProcess } from 'child_process';
import * as path from 'path';
import { Disposable, Position, Range, TextDocument, TextEditorOptions, Uri, window } from 'vscode';
import '../common/extensions';
import { createDeferred, Deferred } from '../common/helpers';
import { IPythonExecutionFactory } from '../common/process/types';
import { IPythonSettings } from '../common/types';
import { getWindowsLineEndingCount, IS_WINDOWS } from '../common/utils';
import { IServiceContainer } from '../ioc/types';

export class RefactorProxy extends Disposable {
    private _process?: ChildProcess;
    private _extensionDir: string;
    private _previousOutData: string = '';
    private _previousStdErrData: string = '';
    private _startedSuccessfully: boolean = false;
    private _commandResolve?: (value?: any | PromiseLike<any>) => void;
    private _commandReject!: (reason?: any) => void;
    private initialized!: Deferred<void>;
    constructor(extensionDir: string, private pythonSettings: IPythonSettings, private workspaceRoot: string,
        private serviceContainer: IServiceContainer) {
        super(() => { });
        this._extensionDir = extensionDir;
    }

    public dispose() {
        try {
            this._process!.kill();
        } catch (ex) {
        }
        this._process = undefined;
    }
    private getOffsetAt(document: TextDocument, position: Position): number {
        if (!IS_WINDOWS) {
            return document.offsetAt(position);
        }

        // get line count
        // Rope always uses LF, instead of CRLF on windows, funny isn't it
        // So for each line, reduce one characer (for CR)
        // But Not all Windows users use CRLF
        const offset = document.offsetAt(position);
        const winEols = getWindowsLineEndingCount(document, offset);

        return offset - winEols;
    }
    public rename<T>(document: TextDocument, name: string, filePath: string, range: Range, options?: TextEditorOptions): Promise<T> {
        if (!options) {
            options = window.activeTextEditor!.options;
        }
        const command = {
            lookup: 'rename',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };

        return this.sendCommand<T>(JSON.stringify(command));
    }
    public extractVariable<T>(document: TextDocument, name: string, filePath: string, range: Range, options?: TextEditorOptions): Promise<T> {
        if (!options) {
            options = window.activeTextEditor!.options;
        }
        const command = {
            lookup: 'extract_variable',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            end: this.getOffsetAt(document, range.end).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };
        return this.sendCommand<T>(JSON.stringify(command));
    }
    public extractMethod<T>(document: TextDocument, name: string, filePath: string, range: Range, options?: TextEditorOptions): Promise<T> {
        if (!options) {
            options = window.activeTextEditor!.options;
        }
        // Ensure last line is an empty line
        if (!document.lineAt(document.lineCount - 1).isEmptyOrWhitespace && range.start.line === document.lineCount - 1) {
            return Promise.reject<T>('Missing blank line at the end of document (PEP8).');
        }
        const command = {
            lookup: 'extract_method',
            file: filePath,
            start: this.getOffsetAt(document, range.start).toString(),
            end: this.getOffsetAt(document, range.end).toString(),
            id: '1',
            name: name,
            indent_size: options.tabSize
        };
        return this.sendCommand<T>(JSON.stringify(command));
    }
    private sendCommand<T>(command: string, telemetryEvent?: string): Promise<T> {
        return this.initialize(this.pythonSettings.pythonPath).then(() => {
            // tslint:disable-next-line:promise-must-complete
            return new Promise<T>((resolve, reject) => {
                this._commandResolve = resolve;
                this._commandReject = reject;
                this._process!.stdin.write(command + '\n');
            });
        });
    }
    private async initialize(pythonPath: string): Promise<void> {
        const pythonProc = await this.serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory).create({ resource: Uri.file(this.workspaceRoot) });
        this.initialized = createDeferred<void>();
        const args = ['refactor.py', this.workspaceRoot];
        const cwd = path.join(this._extensionDir, 'pythonFiles');
        const result = pythonProc.execObservable(args, { cwd });
        this._process = result.proc;
        result.out.subscribe(output => {
            if (output.source === 'stdout') {
                if (!this._startedSuccessfully && output.out.startsWith('STARTED')) {
                    this._startedSuccessfully = true;
                    return this.initialized.resolve();
                }
                this.onData(output.out);
            } else {
                this.handleStdError(output.out);
            }
        }, error => this.handleError(error));

        return this.initialized.promise;
    }
    private handleStdError(data: string) {
        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousStdErrData = this._previousStdErrData + data + '';
        let errorResponse: { message: string; traceback: string; type: string }[];
        try {
            errorResponse = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousStdErrData = '';
        } catch (ex) {
            console.error(ex);
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        if (typeof errorResponse[0].message !== 'string' || errorResponse[0].message.length === 0) {
            errorResponse[0].message = errorResponse[0].traceback.splitLines().pop()!;
        }
        let errorMessage = errorResponse[0].message + '\n' + errorResponse[0].traceback;

        if (this._startedSuccessfully) {
            this._commandReject(`Refactor failed. ${errorMessage}`);
        } else {
            if (typeof errorResponse[0].type === 'string' && errorResponse[0].type === 'ModuleNotFoundError') {
                this.initialized.reject('Not installed');
                return;
            }

            this.initialized.reject(`Refactor failed. ${errorMessage}`);
        }
    }
    private handleError(error: Error) {
        if (this._startedSuccessfully) {
            return this._commandReject(error);
        }
        this.initialized.reject(error);
    }
    private onData(data: string) {
        if (!this._commandResolve) { return; }

        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousOutData = this._previousOutData + data + '';
        let response: any;
        try {
            response = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousOutData = '';
        } catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        this.dispose();
        this._commandResolve!(response[0]);
        this._commandResolve = undefined;
    }
}
