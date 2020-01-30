// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable, multiInject, named } from 'inversify';
import * as path from 'path';
import { Event, EventEmitter, Memento, Uri, ViewColumn, WebviewPanel } from 'vscode';

import { createCodeCell, createErrorOutput } from '../../../datascience-ui/common/cellFactory';
import { IApplicationShell, ICommandManager, IDocumentManager, ILiveShareApi, IWebPanelProvider, IWorkspaceService } from '../../common/application/types';
import { ContextKey } from '../../common/contextKey';
import { traceError } from '../../common/logger';
import { IFileSystem, TemporaryFile } from '../../common/platform/types';
import { GLOBAL_MEMENTO, IConfigurationService, IDisposableRegistry, IMemento } from '../../common/types';
import { createDeferred, Deferred } from '../../common/utils/async';
import * as localize from '../../common/utils/localize';
import { StopWatch } from '../../common/utils/stopWatch';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService } from '../../interpreter/contracts';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { Commands, EditorContexts, Identifiers, NativeKeyboardCommandTelemetryLookup, NativeMouseCommandTelemetryLookup, Telemetry } from '../constants';
import { InteractiveBase } from '../interactive-common/interactiveBase';
import {
    IEditCell,
    IInsertCell,
    INativeCommand,
    InteractiveWindowMessages,
    IRemoveCell,
    ISaveAll,
    ISubmitNewCell,
    ISwapCells,
    SysInfoReason
} from '../interactive-common/interactiveWindowTypes';
import { ProgressReporter } from '../progress/progressReporter';
import {
    CellState,
    ICell,
    ICodeCssGenerator,
    IDataScienceErrorHandler,
    IDataViewerProvider,
    IInteractiveWindowInfo,
    IInteractiveWindowListener,
    IJupyterDebugger,
    IJupyterExecution,
    IJupyterVariables,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookExporter,
    INotebookImporter,
    INotebookModel,
    INotebookModelChange,
    INotebookServerOptions,
    IStatusProvider,
    IThemeFinder
} from '../types';

const nativeEditorDir = path.join(EXTENSION_ROOT_DIR, 'out', 'datascience-ui', 'native-editor');
@injectable()
export class NativeEditor extends InteractiveBase implements INotebookEditor {
    public get onDidChangeViewState(): Event<void> {
        return this._onDidChangeViewState.event;
    }
    private _onDidChangeViewState = new EventEmitter<void>();
    private closedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private executedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private modifiedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private savedEvent: EventEmitter<INotebookEditor> = new EventEmitter<INotebookEditor>();
    private loadedPromise: Deferred<void> = createDeferred<void>();
    private startupTimer: StopWatch = new StopWatch();
    private loadedAllCells: boolean = false;
    private _model: INotebookModel | undefined;

    constructor(
        @multiInject(IInteractiveWindowListener) listeners: IInteractiveWindowListener[],
        @inject(ILiveShareApi) liveShare: ILiveShareApi,
        @inject(IApplicationShell) applicationShell: IApplicationShell,
        @inject(IDocumentManager) documentManager: IDocumentManager,
        @inject(IInterpreterService) interpreterService: IInterpreterService,
        @inject(IWebPanelProvider) provider: IWebPanelProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(ICodeCssGenerator) cssGenerator: ICodeCssGenerator,
        @inject(IThemeFinder) themeFinder: IThemeFinder,
        @inject(IStatusProvider) statusProvider: IStatusProvider,
        @inject(IJupyterExecution) jupyterExecution: IJupyterExecution,
        @inject(IFileSystem) fileSystem: IFileSystem,
        @inject(IConfigurationService) configuration: IConfigurationService,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookExporter) jupyterExporter: INotebookExporter,
        @inject(IWorkspaceService) workspaceService: IWorkspaceService,
        @inject(INotebookEditorProvider) private editorProvider: INotebookEditorProvider,
        @inject(IDataViewerProvider) dataExplorerProvider: IDataViewerProvider,
        @inject(IJupyterVariables) jupyterVariables: IJupyterVariables,
        @inject(IJupyterDebugger) jupyterDebugger: IJupyterDebugger,
        @inject(INotebookImporter) private importer: INotebookImporter,
        @inject(IDataScienceErrorHandler) errorHandler: IDataScienceErrorHandler,
        @inject(IMemento) @named(GLOBAL_MEMENTO) globalStorage: Memento,
        @inject(ProgressReporter) progressReporter: ProgressReporter
    ) {
        super(
            progressReporter,
            listeners,
            liveShare,
            applicationShell,
            documentManager,
            interpreterService,
            provider,
            disposables,
            cssGenerator,
            themeFinder,
            statusProvider,
            jupyterExecution,
            fileSystem,
            configuration,
            jupyterExporter,
            workspaceService,
            dataExplorerProvider,
            jupyterVariables,
            jupyterDebugger,
            errorHandler,
            commandManager,
            globalStorage,
            nativeEditorDir,
            [path.join(nativeEditorDir, 'index_bundle.js')],
            localize.DataScience.nativeEditorTitle(),
            ViewColumn.Active
        );
    }

    public get visible(): boolean {
        return this.viewState.visible;
    }

    public get active(): boolean {
        return this.viewState.active;
    }

    public get file(): Uri {
        if (this._model) {
            return this._model.file;
        }
        return Uri.file('');
    }

    public get isUntitled(): boolean {
        return this._model ? this._model.isUntitled : false;
    }
    public dispose(): Promise<void> {
        super.dispose();
        return this.close();
    }

    public async load(model: INotebookModel, webViewPanel: WebviewPanel): Promise<void> {
        // Save the model we're using
        this._model = model;

        // Indicate we have our identity
        this.loadedPromise.resolve();

        // Load the web panel using our file path so it can find
        // relative files next to the notebook.
        await super.loadWebPanel(path.dirname(this.file.fsPath), webViewPanel);

        // Sign up for dirty events
        model.changed(this.modelChanged.bind(this));

        // Load our cells, but don't wait for this to finish, otherwise the window won't load.
        this.sendInitialCellsToWebView(model.cells)
            .then(() => {
                // May alread be dirty, if so send a message
                if (model.isDirty) {
                    this.postMessage(InteractiveWindowMessages.NotebookDirty).ignoreErrors();
                }
            })
            .catch(exc => traceError('Error loading cells: ', exc));
    }

    public get closed(): Event<INotebookEditor> {
        return this.closedEvent.event;
    }

    public get executed(): Event<INotebookEditor> {
        return this.executedEvent.event;
    }

    public get modified(): Event<INotebookEditor> {
        return this.modifiedEvent.event;
    }

    public get saved(): Event<INotebookEditor> {
        return this.savedEvent.event;
    }

    public get isDirty(): boolean {
        return this._model ? this._model.isDirty : false;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload: any) {
        super.onMessage(message, payload);
        switch (message) {
            case InteractiveWindowMessages.ReExecuteCell:
                this.executedEvent.fire(this);
                break;

            case InteractiveWindowMessages.SaveAll:
                this.handleMessage(message, payload, this.saveAll);
                break;

            case InteractiveWindowMessages.Export:
                this.handleMessage(message, payload, this.export);
                break;

            case InteractiveWindowMessages.EditCell:
                this.handleMessage(message, payload, this.editCell);
                break;

            case InteractiveWindowMessages.InsertCell:
                this.handleMessage(message, payload, this.insertCell);
                break;

            case InteractiveWindowMessages.RemoveCell:
                this.handleMessage(message, payload, this.removeCell);
                break;

            case InteractiveWindowMessages.SwapCells:
                this.handleMessage(message, payload, this.swapCells);
                break;

            case InteractiveWindowMessages.DeleteAllCells:
                this.handleMessage(message, payload, this.removeAllCells);
                break;

            case InteractiveWindowMessages.NativeCommand:
                this.handleMessage(message, payload, this.logNativeCommand);
                break;

            // call this to update the whole document for intellisense
            case InteractiveWindowMessages.LoadAllCellsComplete:
                this.handleMessage(message, payload, this.loadCellsComplete);
                break;

            case InteractiveWindowMessages.ClearAllOutputs:
                this.handleMessage(message, payload, this.clearAllOutputs);
                break;

            default:
                break;
        }
    }

    public async getNotebookOptions(): Promise<INotebookServerOptions> {
        const options = await this.editorProvider.getNotebookOptions();
        if (this._model) {
            const metadata = (await this._model.getJson()).metadata;
            return {
                ...options,
                metadata
            };
        } else {
            return options;
        }
    }

    public runAllCells() {
        this.postMessage(InteractiveWindowMessages.NotebookRunAllCells).ignoreErrors();
    }

    public runSelectedCell() {
        this.postMessage(InteractiveWindowMessages.NotebookRunSelectedCell).ignoreErrors();
    }

    public addCellBelow() {
        this.postMessage(InteractiveWindowMessages.NotebookAddCellBelow).ignoreErrors();
    }

    public async removeAllCells(): Promise<void> {
        super.removeAllCells();
        // Clear our visible cells in our model too. This should cause an update to the model
        // that will fire off a changed event
        this.commandManager.executeCommand(Commands.NotebookStorage_DeleteAllCells, this.file);
    }

    protected addSysInfo(_reason: SysInfoReason): Promise<void> {
        // These are not supported.
        return Promise.resolve();
    }

    @captureTelemetry(Telemetry.SubmitCellThroughInput, undefined, false)
    // tslint:disable-next-line:no-any
    protected submitNewCell(info: ISubmitNewCell) {
        // If there's any payload, it has the code and the id
        if (info && info.code && info.id) {
            try {
                // Activate the other side, and send as if came from a file
                this.editorProvider
                    .show(this.file)
                    .then(_v => {
                        this.shareMessage(InteractiveWindowMessages.RemoteAddCode, {
                            code: info.code,
                            file: Identifiers.EmptyFileName,
                            line: 0,
                            id: info.id,
                            originator: this.id,
                            debug: false
                        });
                    })
                    .ignoreErrors();
                // Send to ourselves.
                this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id).ignoreErrors();
            } catch (exc) {
                this.errorHandler.handleError(exc).ignoreErrors();
            }
        }
    }

    @captureTelemetry(Telemetry.ExecuteNativeCell, undefined, false)
    // tslint:disable-next-line:no-any
    protected async reexecuteCell(info: ISubmitNewCell): Promise<void> {
        try {
            // If there's any payload, it has the code and the id
            if (info && info.code && info.id) {
                // Clear the result if we've run before
                await this.clearResult(info.id);

                // Send to ourselves.
                await this.submitCode(info.code, Identifiers.EmptyFileName, 0, info.id);

                // Activate the other side, and send as if came from a file
                await this.editorProvider.show(this.file);
                this.shareMessage(InteractiveWindowMessages.RemoteReexecuteCode, {
                    code: info.code,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    id: info.id,
                    originator: this.id,
                    debug: false
                });
            }
        } catch (exc) {
            // Make this error our cell output
            this.sendCellsToWebView([
                {
                    data: createCodeCell([info.code], [createErrorOutput(exc)]),
                    id: info.id,
                    file: Identifiers.EmptyFileName,
                    line: 0,
                    state: CellState.error
                }
            ]);

            // Tell the other side we restarted the kernel. This will stop all executions
            this.postMessage(InteractiveWindowMessages.RestartKernel).ignoreErrors();

            // Handle an error
            await this.errorHandler.handleError(exc);
        }
    }

    protected async getNotebookIdentity(): Promise<Uri> {
        await this.loadedPromise.promise;

        // File should be set now
        return this.file;
    }

    protected async setLaunchingFile(_file: string): Promise<void> {
        // For the native editor, use our own file as the path
        const notebook = this.getNotebook();
        if (this.fileSystem.fileExists(this.file.fsPath) && notebook) {
            await notebook.setLaunchingFile(this.file.fsPath);
        }
    }

    protected sendCellsToWebView(cells: ICell[]) {
        // Filter out sysinfo messages. Don't want to show those
        const filtered = cells.filter(c => c.data.cell_type !== 'messages');

        // Update these cells in our storage
        this.commandManager.executeCommand(Commands.NotebookStorage_ModifyCells, this.file, cells);

        // Tell storage about our notebook object
        const notebook = this.getNotebook();
        if (notebook) {
            const interpreter = notebook.getMatchingInterpreter();
            const kernelSpec = notebook.getKernelSpec();
            this.commandManager.executeCommand(Commands.NotebookStorage_UpdateVersion, this.file, interpreter, kernelSpec);
        }

        // Send onto the webview.
        super.sendCellsToWebView(filtered);
    }

    protected updateContexts(info: IInteractiveWindowInfo | undefined) {
        // This should be called by the python interactive window every
        // time state changes. We use this opportunity to update our
        // extension contexts
        if (this.commandManager && this.commandManager.executeCommand) {
            const interactiveContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
            interactiveContext.set(!this.isDisposed).catch();
            const interactiveCellsContext = new ContextKey(EditorContexts.HaveNativeCells, this.commandManager);
            const redoableContext = new ContextKey(EditorContexts.HaveNativeRedoableCells, this.commandManager);
            const hasCellSelectedContext = new ContextKey(EditorContexts.HaveCellSelected, this.commandManager);
            if (info) {
                interactiveCellsContext.set(info.cellCount > 0).catch();
                redoableContext.set(info.redoCount > 0).catch();
                hasCellSelectedContext.set(info.selectedCell ? true : false).catch();
            } else {
                hasCellSelectedContext.set(false).catch();
                interactiveCellsContext.set(false).catch();
                redoableContext.set(false).catch();
            }
        }
    }

    protected async onViewStateChanged(visible: boolean, active: boolean) {
        super.onViewStateChanged(visible, active);

        // Update our contexts
        const interactiveContext = new ContextKey(EditorContexts.HaveNative, this.commandManager);
        interactiveContext.set(visible && active).catch();
        this._onDidChangeViewState.fire();
    }

    protected async closeBecauseOfFailure(_exc: Error): Promise<void> {
        // Actually don't close, just let the error bubble out
    }

    private modelChanged(change: INotebookModelChange) {
        if (change.isDirty !== undefined) {
            this.modifiedEvent.fire();
            if (change.model.isDirty) {
                return this.postMessage(InteractiveWindowMessages.NotebookDirty);
            } else {
                // Going clean should only happen on a save (for now. Undo might do this too)
                this.savedEvent.fire(this);

                // Then tell the UI
                return this.postMessage(InteractiveWindowMessages.NotebookClean);
            }
        }
    }

    private async sendInitialCellsToWebView(cells: ICell[]): Promise<void> {
        sendTelemetryEvent(Telemetry.CellCount, undefined, { count: cells.length });
        return this.postMessage(InteractiveWindowMessages.LoadAllCells, { cells });
    }

    private async close(): Promise<void> {
        // Fire our event
        this.closedEvent.fire(this);

        // Restart our kernel so that execution counts are reset
        let oldAsk: boolean | undefined = false;
        const settings = this.configuration.getSettings();
        if (settings && settings.datascience) {
            oldAsk = settings.datascience.askForKernelRestart;
            settings.datascience.askForKernelRestart = false;
        }
        await this.restartKernel();
        if (oldAsk && settings && settings.datascience) {
            settings.datascience.askForKernelRestart = true;
        }
    }

    private async editCell(request: IEditCell) {
        this.commandManager.executeCommand(Commands.NotebookStorage_EditCell, this.file, request);
    }

    private async insertCell(request: IInsertCell): Promise<void> {
        this.commandManager.executeCommand(Commands.NotebookStorage_InsertCell, this.file, request);
    }

    private async removeCell(request: IRemoveCell): Promise<void> {
        this.commandManager.executeCommand(Commands.NotebookStorage_RemoveCell, this.file, request.id);
    }

    private async swapCells(request: ISwapCells): Promise<void> {
        // Swap two cells in our list
        this.commandManager.executeCommand(Commands.NotebookStorage_SwapCells, this.file, request);
    }

    @captureTelemetry(Telemetry.ConvertToPythonFile, undefined, false)
    private async export(cells: ICell[]): Promise<void> {
        const status = this.setStatus(localize.DataScience.convertingToPythonFile(), false);
        // First generate a temporary notebook with these cells.
        let tempFile: TemporaryFile | undefined;
        try {
            tempFile = await this.fileSystem.createTemporaryFile('.ipynb');

            // Translate the cells into a notebook
            const content = this._model ? await this._model.getContent(cells) : '';
            await this.fileSystem.writeFile(tempFile.filePath, content, 'utf-8');

            // Import this file and show it
            const contents = await this.importer.importFromFile(tempFile.filePath, this.file.fsPath);
            if (contents) {
                await this.viewDocument(contents);
            }
        } catch (e) {
            await this.errorHandler.handleError(e);
        } finally {
            if (tempFile) {
                tempFile.dispose();
            }
            status.dispose();
        }
    }

    private async viewDocument(contents: string): Promise<void> {
        const doc = await this.documentManager.openTextDocument({ language: 'python', content: contents });
        await this.documentManager.showTextDocument(doc, ViewColumn.One);
    }

    private async saveAll(_args: ISaveAll) {
        // Ask user for a save as dialog if no title
        if (this.isUntitled) {
            this.commandManager.executeCommand('workbench.action.files.saveAs', this.file);
        } else {
            this.commandManager.executeCommand('workbench.action.files.save', this.file);
        }
    }

    private logNativeCommand(args: INativeCommand) {
        const telemetryEvent = args.source === 'mouse' ? NativeMouseCommandTelemetryLookup[args.command] : NativeKeyboardCommandTelemetryLookup[args.command];
        sendTelemetryEvent(telemetryEvent);
    }

    private loadCellsComplete() {
        if (!this.loadedAllCells) {
            this.loadedAllCells = true;
            sendTelemetryEvent(Telemetry.NotebookOpenTime, this.startupTimer.elapsedTime);
        }
    }

    private async clearAllOutputs() {
        this.commandManager.executeCommand(Commands.NotebookStorage_ClearCellOutputs, this.file);
    }
}
