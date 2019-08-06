// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { Kernel, KernelMessage } from '@jupyterlab/services/lib/kernel';
import { JSONObject } from '@phosphor/coreutils';
import { Observable } from 'rxjs/Observable';
import { CancellationToken, CodeLens, CodeLensProvider, DebugAdapterTracker, DebugAdapterTrackerFactory, DebugSession, Disposable, Event, Range, TextDocument, TextEditor } from 'vscode';

import { ICommandManager } from '../common/application/types';
import { ExecutionResult, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { IAsyncDisposable, IDataScienceSettings, IDisposable } from '../common/types';
import { StopWatch } from '../common/utils/stopWatch';
import { PythonInterpreter } from '../interpreter/contracts';

// Main interface
export const IDataScience = Symbol('IDataScience');
export interface IDataScience extends Disposable {
    activationStartTime: number;
    activate(): Promise<void>;
}

export const IDataScienceCommandListener = Symbol('IDataScienceCommandListener');
export interface IDataScienceCommandListener {
    register(commandManager: ICommandManager): void;
}

// Connection information for talking to a jupyter notebook process
export interface IConnection extends Disposable {
    baseUrl: string;
    token: string;
    hostName: string;
    localLaunch: boolean;
    localProcExitCode: number | undefined;
    disconnected: Event<number>;
    allowUnauthorized?: boolean;
}

export enum InterruptResult {
    Success = 0,
    TimedOut = 1,
    Restarted = 2
}

// Information used to launch a notebook server
export interface INotebookServerLaunchInfo {
    connectionInfo: IConnection;
    currentInterpreter: PythonInterpreter | undefined;
    uri: string | undefined; // Different from the connectionInfo as this is the setting used, not the result
    kernelSpec: IJupyterKernelSpec | undefined;
    workingDir: string | undefined;
    purpose: string | undefined; // Purpose this server is for
    enableDebugging: boolean | undefined; // If we should enable debugging for this server
}

export interface INotebookCompletion {
    matches: ReadonlyArray<string>;
    cursor: {
        start: number;
        end: number;
    };
    metadata: {};
}

// Talks to a jupyter ipython kernel to retrieve data for cells
export const INotebookServer = Symbol('INotebookServer');
export interface INotebookServer extends IAsyncDisposable {
    readonly id: string;
    connect(launchInfo: INotebookServerLaunchInfo, cancelToken?: CancellationToken): Promise<void>;
    executeObservable(code: string, file: string, line: number, id: string, silent: boolean): Observable<ICell[]>;
    execute(code: string, file: string, line: number, id: string, cancelToken?: CancellationToken, silent?: boolean): Promise<ICell[]>;
    getCompletion(cellCode: string, offsetInCode: number, cancelToken?: CancellationToken): Promise<INotebookCompletion>;
    restartKernel(timeoutInMs: number): Promise<void>;
    waitForIdle(timeoutInMs: number): Promise<void>;
    shutdown(): Promise<void>;
    interruptKernel(timeoutInMs: number): Promise<InterruptResult>;
    setInitialDirectory(directory: string): Promise<void>;
    waitForConnect(): Promise<INotebookServerLaunchInfo | undefined>;
    getConnectionInfo(): IConnection | undefined;
    getSysInfo(): Promise<ICell | undefined>;
    setMatplotLibStyle(useDark: boolean): Promise<void>;
}

export interface INotebookServerOptions {
    enableDebugging?: boolean;
    uri?: string;
    usingDarkTheme?: boolean;
    useDefaultConfig?: boolean;
    workingDir?: string;
    purpose: string;
}

export const INotebookExecutionLogger = Symbol('INotebookExecutionLogger');
export interface INotebookExecutionLogger {
    preExecute(cell: ICell, silent: boolean): Promise<void>;
    postExecute(cell: ICell, silent: boolean): Promise<void>;
}

export const IGatherExecution = Symbol('IGatherExecution');
export interface IGatherExecution {
    enabled: boolean;
    gatherCode(vscCell: ICell): string;
}

export const IJupyterExecution = Symbol('IJupyterExecution');
export interface IJupyterExecution extends IAsyncDisposable {
    sessionChanged: Event<void>;
    isNotebookSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isImportSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isKernelCreateSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isKernelSpecSupported(cancelToken?: CancellationToken): Promise<boolean>;
    isSpawnSupported(cancelToken?: CancellationToken): Promise<boolean>;
    connectToNotebookServer(options?: INotebookServerOptions, cancelToken?: CancellationToken): Promise<INotebookServer | undefined>;
    spawnNotebook(file: string): Promise<void>;
    importNotebook(file: string, template: string | undefined): Promise<string>;
    getUsableJupyterPython(cancelToken?: CancellationToken): Promise<PythonInterpreter | undefined>;
    getServer(options?: INotebookServerOptions): Promise<INotebookServer | undefined>;
}

export const IJupyterDebugger = Symbol('IJupyterDebugger');
export interface IJupyterDebugger {
    startDebugging(server: INotebookServer): Promise<void>;
    stopDebugging(server: INotebookServer): Promise<void>;
    onRestart(server: INotebookServer): void;
}

export interface IJupyterPasswordConnectInfo {
    xsrfCookie: string;
    sessionCookieName: string;
    sessionCookieValue: string;
}

export const IJupyterPasswordConnect = Symbol('IJupyterPasswordConnect');
export interface IJupyterPasswordConnect {
    getPasswordConnectionInfo(url: string, allowUnauthorized: boolean): Promise<IJupyterPasswordConnectInfo | undefined>;
}

export const IJupyterSession = Symbol('IJupyterSession');
export interface IJupyterSession extends IAsyncDisposable {
    onRestarted: Event<void>;
    restart(timeout: number): Promise<void>;
    interrupt(timeout: number): Promise<void>;
    waitForIdle(timeout: number): Promise<void>;
    requestExecute(content: KernelMessage.IExecuteRequest, disposeOnDone?: boolean, metadata?: JSONObject): Kernel.IFuture | undefined;
    requestComplete(content: KernelMessage.ICompleteRequest): Promise<KernelMessage.ICompleteReplyMsg | undefined>;
}
export const IJupyterSessionManager = Symbol('IJupyterSessionManager');
export interface IJupyterSessionManager {
    startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec | undefined, cancelToken?: CancellationToken): Promise<IJupyterSession>;
    getActiveKernelSpecs(connInfo: IConnection): Promise<IJupyterKernelSpec[]>;
}

export interface IJupyterKernelSpec extends IAsyncDisposable {
    name: string | undefined;
    language: string | undefined;
    path: string | undefined;
}

export const INotebookImporter = Symbol('INotebookImporter');
export interface INotebookImporter extends Disposable {
    importFromFile(file: string): Promise<string>;
}

export const INotebookExporter = Symbol('INotebookExporter');
export interface INotebookExporter extends Disposable {
    translateToNotebook(cells: ICell[], directoryChange?: string): Promise<JSONObject | undefined>;
}

export const IInteractiveWindowProvider = Symbol('IInteractiveWindowProvider');
export interface IInteractiveWindowProvider {
    onExecutedCode: Event<string>;
    getActive(): IInteractiveWindow | undefined;
    getOrCreateActive(): Promise<IInteractiveWindow>;
    getNotebookOptions(): Promise<INotebookServerOptions>;
}

export const IDataScienceErrorHandler = Symbol('IDataScienceErrorHandler');
export interface IDataScienceErrorHandler {
    handleError(err: Error): Promise<void>;
}

export const IInteractiveWindow = Symbol('IInteractiveWindow');
export interface IInteractiveWindow extends Disposable {
    closed: Event<IInteractiveWindow>;
    ready: Promise<void>;
    onExecutedCode: Event<string>;
    show(): Promise<void>;
    addCode(code: string, file: string, line: number, editor?: TextEditor, runningStopWatch?: StopWatch): Promise<boolean>;
    addMessage(message: string): Promise<void>;
    debugCode(code: string, file: string, line: number, editor?: TextEditor, runningStopWatch?: StopWatch): Promise<boolean>;
    startProgress(): void;
    stopProgress(): void;
    undoCells(): void;
    redoCells(): void;
    removeAllCells(): void;
    interruptKernel(): Promise<void>;
    restartKernel(): Promise<void>;
    expandAllCells(): void;
    collapseAllCells(): void;
    exportCells(): void;
    previewNotebook(notebookFile: string): Promise<void>;
    scrollToCell(id: string): void;
}

export const IInteractiveWindowListener = Symbol('IInteractiveWindowListener');

/**
 * Listens to history messages to provide extra functionality
 */
export interface IInteractiveWindowListener extends IDisposable {
    /**
     * Fires this event when posting a response message
     */
    // tslint:disable-next-line: no-any
    postMessage: Event<{ message: string; payload: any }>;
    /**
     * Handles messages that the interactive window receives
     * @param message message type
     * @param payload message payload
     */
    // tslint:disable-next-line: no-any
    onMessage(message: string, payload?: any): void;
}

// Wraps the vscode API in order to send messages back and forth from a webview
export const IPostOffice = Symbol('IPostOffice');
export interface IPostOffice {
    // tslint:disable-next-line:no-any
    post(message: string, params: any[] | undefined): void;
    // tslint:disable-next-line:no-any
    listen(message: string, listener: (args: any[] | undefined) => void): void;
}

// Wraps the vscode CodeLensProvider base class
export const IDataScienceCodeLensProvider = Symbol('IDataScienceCodeLensProvider');
export interface IDataScienceCodeLensProvider extends CodeLensProvider {
    getCodeWatcher(document: TextDocument): ICodeWatcher | undefined;
}

// Wraps the Code Watcher API
export const ICodeWatcher = Symbol('ICodeWatcher');
export interface ICodeWatcher {
    codeLensUpdated: Event<void>;
    setDocument(document: TextDocument): void;
    getFileName(): string;
    getVersion(): number;
    getCodeLenses(): CodeLens[];
    getCachedSettings(): IDataScienceSettings | undefined;
    runAllCells(): Promise<void>;
    runCell(range: Range): Promise<void>;
    debugCell(range: Range): Promise<void>;
    runCurrentCell(): Promise<void>;
    runCurrentCellAndAdvance(): Promise<void>;
    runSelectionOrLine(activeEditor: TextEditor | undefined): Promise<void>;
    runToLine(targetLine: number): Promise<void>;
    runFromLine(targetLine: number): Promise<void>;
    runAllCellsAbove(stopLine: number, stopCharacter: number): Promise<void>;
    runCellAndAllBelow(startLine: number, startCharacter: number): Promise<void>;
    runFileInteractive(): Promise<void>;
    debugFileInteractive(): Promise<void>;
    addEmptyCellToBottom(): Promise<void>;
    runCurrentCellAndAddBelow(): Promise<void>;
    debugCurrentCell(): Promise<void>;
}

export const ICodeLensFactory = Symbol('ICodeLensFactory');
export interface ICodeLensFactory {
    updateRequired: Event<void>;
    createCodeLenses(document: TextDocument): CodeLens[];
}

export enum CellState {
    editing = -1,
    init = 0,
    executing = 1,
    finished = 2,
    error = 3
}

// Basic structure for a cell from a notebook
export interface ICell {
    id: string; // This value isn't unique. File and line are needed to.
    file: string;
    line: number;
    state: CellState;
    type: 'preview' | 'execute';
    data: nbformat.ICodeCell | nbformat.IRawCell | nbformat.IMarkdownCell | IMessageCell;
    extraLines?: number[];
}

export interface IInteractiveWindowInfo {
    cellCount: number;
    undoCount: number;
    redoCount: number;
    visibleCells: ICell[];
}

export interface IMessageCell extends nbformat.IBaseCell {
    cell_type: 'messages';
    messages: string[];
}

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss(isDark: boolean, theme: string): Promise<string>;
    generateMonacoTheme(isDark: boolean, theme: string): Promise<JSONObject>;
}

export const IThemeFinder = Symbol('IThemeFinder');
export interface IThemeFinder {
    findThemeRootJson(themeName: string): Promise<string | undefined>;
    findTmLanguage(language: string): Promise<string | undefined>;
    isThemeDark(themeName: string): Promise<boolean | undefined>;
}

export const IStatusProvider = Symbol('IStatusProvider');
export interface IStatusProvider {
    // call this function to set the new status on the active
    // interactive window. Dispose of the returned object when done.
    set(message: string, timeout?: number): Disposable;

    // call this function to wait for a promise while displaying status
    waitWithStatus<T>(promise: () => Promise<T>, message: string, timeout?: number, canceled?: () => void, skipHistory?: boolean): Promise<T>;
}

export interface IJupyterCommand {
    interpreter(): Promise<PythonInterpreter | undefined>;
    execObservable(args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>>;
    exec(args: string[], options: SpawnOptions): Promise<ExecutionResult<string>>;
}

export const IJupyterCommandFactory = Symbol('IJupyterCommandFactory');
export interface IJupyterCommandFactory {
    createInterpreterCommand(args: string[], interpreter: PythonInterpreter): IJupyterCommand;
    createProcessCommand(exe: string, args: string[]): IJupyterCommand;
}

// Config settings we pass to our react code
export interface IDataScienceExtraSettings extends IDataScienceSettings {
    extraSettings: {
        editorCursor: string;
        editorCursorBlink: string;
        theme: string;
    };
    intellisenseOptions: {
        quickSuggestions: {
            other: boolean;
            comments: boolean;
            strings: boolean;
        };
        acceptSuggestionOnEnter: boolean | 'on' | 'smart' | 'off';
        quickSuggestionsDelay: number;
        suggestOnTriggerCharacters: boolean;
        tabCompletion: boolean | 'on' | 'off' | 'onlySnippets';
        suggestLocalityBonus: boolean;
        suggestSelection: 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix';
        wordBasedSuggestions: boolean;
        parameterHintsEnabled: boolean;
    };
}

// Get variables from the currently running active Jupyter server
// Note: This definition is used implicitly by getJupyterVariableValue.py file
// Changes here may need to be reflected there as well
export interface IJupyterVariable {
    name: string;
    value: string | undefined;
    executionCount?: number;
    supportsDataExplorer: boolean;
    type: string;
    size: number;
    shape: string;
    count: number;
    truncated: boolean;
    columns?: { key: string; type: string }[];
    rowCount?: number;
    indexColumn?: string;
}

export const IJupyterVariables = Symbol('IJupyterVariables');
export interface IJupyterVariables {
    getVariables(): Promise<IJupyterVariable[]>;
    getValue(targetVariable: IJupyterVariable): Promise<IJupyterVariable>;
    getDataFrameInfo(targetVariable: IJupyterVariable): Promise<IJupyterVariable>;
    getDataFrameRows(targetVariable: IJupyterVariable, start: number, end: number): Promise<JSONObject>;
}

// Wrapper to hold an execution count for our variable requests
export interface IJupyterVariablesResponse {
    executionCount: number;
    variables: IJupyterVariable[];
}

export const IDataViewerProvider = Symbol('IDataViewerProvider');
export interface IDataViewerProvider {
    create(variable: string): Promise<IDataViewer>;
}
export const IDataViewer = Symbol('IDataViewer');

export interface IDataViewer extends IDisposable {
    showVariable(variable: IJupyterVariable): Promise<void>;
}

export const IPlotViewerProvider = Symbol('IPlotViewerProvider');
export interface IPlotViewerProvider {
    showPlot(imageHtml: string): Promise<void>;
}
export const IPlotViewer = Symbol('IPlotViewer');

export interface IPlotViewer extends IDisposable {
    closed: Event<IPlotViewer>;
    removed: Event<number>;
    addPlot(imageHtml: string): Promise<void>;
    show(): Promise<void>;
}

export interface ISourceMapMapping {
    line: number;
    endLine: number;
    runtimeSource: { path: string };
    runtimeLine: number;
}

export interface ISourceMapRequest {
    source: { path: string };
    pydevdSourceMaps: ISourceMapMapping[];
}

export interface ICellHash {
    line: number; // 1 based
    endLine: number; // 1 based and inclusive
    runtimeLine: number; // Line in the jupyter source to start at
    hash: string;
    executionCount: number;
    id: string;         // Cell id as sent to jupyter
}

export interface IFileHashes {
    file: string;
    hashes: ICellHash[];
}

export const ICellHashListener = Symbol('ICellHashListener');
export interface ICellHashListener {
    hashesUpdated(hashes: IFileHashes[]): Promise<void>;
}

export const ICellHashProvider = Symbol('ICellHashProvider');
export interface ICellHashProvider {
    updated: Event<void>;
    getHashes(): IFileHashes[];
}

export const IDebugLocationTrackerFactory = Symbol('IDebugLocationTrackerFactory');
export interface IDebugLocationTrackerFactory extends DebugAdapterTrackerFactory {
}

export interface IDebugLocation {
    fileName: string;
    lineNumber: number;
    column: number;
}

export const IDebugLocationTracker = Symbol('IDebugLocationTracker');
export interface IDebugLocationTracker extends DebugAdapterTracker {
    debugLocationUpdated: Event<void>;
    debugLocation: IDebugLocation | undefined;
    setDebugSession(targetSession: DebugSession): void;
}
