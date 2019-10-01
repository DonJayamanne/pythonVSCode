// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as path from 'path';
import {
    CancellationToken,
    CodeLens,
    CodeLensProvider,
    debug,
    DebugAdapterTracker,
    DebugSession,
    Event,
    EventEmitter,
    languages,
    Range,
    TextDocument,
    TreeDataProvider,
    TreeItem,
    TreeView
} from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IApplicationShell, ICommandManager } from '../common/application/types';
import { PYTHON } from '../common/constants';
import { IFileSystem } from '../common/platform/types';
import { EXTENSION_ROOT_DIR } from '../constants';
import { IServiceContainer } from '../ioc/types';
import { DataViewer } from './data-viewing/dataViewer';
import { PythonVariables } from './jupyter/pythonVariables';
import { IDataViewer, IDebugLocation, IJupyterVariable } from './types';

export class DebugVariableTreeViewProvider implements TreeDataProvider<IJupyterVariable> {
    public get onDidChangeTreeData(): Event<IJupyterVariable | undefined> {
        return this._onDidChangeTreeData.event;
    }
    private _onDidChangeTreeData = new EventEmitter<IJupyterVariable | undefined>();
    private variables: IJupyterVariable[] = [];
    public async getTreeItem(element: IJupyterVariable): Promise<TreeItem> {
        // const defaultCollapsibleState = await this.shouldElementBeExpandedByDefault(element) ? TreeItemCollapsibleState.Expanded : undefined;
        // return new TestTreeItem(element.resource, element, defaultCollapsibleState);
        const item = new TreeItem(`${element.name}`);
        item.description = element.type;
        item.iconPath = path.join(EXTENSION_ROOT_DIR, 'resources', 'neutral', 'jupyter.svg');
        item.id = element.variableReference!.toString();
        item.contextValue = element.type;
        item.tooltip = 'Click to view in a rich Data Explorer 😉';
        return item;
    }
    public async getChildren(element?: IJupyterVariable): Promise<IJupyterVariable[]> {
        return element ? [] : this.variables;
    }

    public async getParent(_element: IJupyterVariable): Promise<IJupyterVariable | undefined> {
        return undefined;
    }
    public refresh(variables: IJupyterVariable[]): void {
        this.variables = variables.filter(item => item.type === 'DataFrame' || item.type === 'list');
        // tslint:disable-next-line: no-use-before-declare
        Provider.instance.displayCodeLenses = true;
        // tslint:disable-next-line: no-use-before-declare
        Provider.instance.codeLensesChanged.fire();
        this._onDidChangeTreeData.fire();
    }
}

export class Provider implements CodeLensProvider {
    public static instance = new Provider();
    public readonly codeLensesChanged = new EventEmitter<void>();
    public displayCodeLenses = false;
    constructor() {
        debug.onDidTerminateDebugSession(() => {
            // tslint:disable-next-line: no-use-before-declare
            DebugVariablesPanel.instance.treeDataProvider.refresh([]);
            this.displayCodeLenses = false;
            Provider.instance.codeLensesChanged.fire();
        });
        debug.onDidStartDebugSession(() => {
            this.displayCodeLenses = true;
            Provider.instance.codeLensesChanged.fire();
        });
    }
    public get onDidChangeCodeLenses(): Event<void> {
        return this.codeLensesChanged.event;
    }
    public async provideCodeLenses(document: TextDocument, _token: CancellationToken): Promise<CodeLens[]> {
        if (this.displayCodeLenses && document.fileName.endsWith('ds.py')) {
            const cmd = { command: 'python.viewDataFrame', title: 'View Data Frame', tooltip: 'View data frame in an awesome viewer', arguments: [] };
            const range = new Range(13, 16, 13, 19);
            return [new CodeLens(range, cmd)];
        }
        return [];
    }
}
export class DebugVariablesPanel {
    public static instance = new DebugVariablesPanel();
    public treeView!: TreeView<IJupyterVariable>;
    public pythonVariables!: PythonVariables;
    public treeDataProvider!: DebugVariableTreeViewProvider;
    public serviceContainer!: IServiceContainer;
    private _debugSession!: DebugSession;
    public get debugSession(): DebugSession {
        return this._debugSession;
    }
    public set debugSession(value: DebugSession) {
        this._debugSession = value;
    }
    public initialize(appShell: IApplicationShell, commandManager: ICommandManager, fileSystem: IFileSystem, serviceContainer: IServiceContainer) {
        if (this.treeView) {
            return;
        }
        this.serviceContainer = serviceContainer;
        this.treeDataProvider = new DebugVariableTreeViewProvider();
        this.treeView = appShell.createTreeView('dsVariables', { showCollapseAll: true, treeDataProvider: this.treeDataProvider });
        console.log(this.treeView.visible);

        commandManager.registerCommand('python.viewList', this.onViewListVariable.bind(this));
        commandManager.registerCommand('python.viewDataFrame', this.onViewDataFrameVariable.bind(this));
        this.pythonVariables = new PythonVariables(fileSystem);
        languages.registerCodeLensProvider(PYTHON, Provider.instance);
    }
    public onViewListVariable(item: IJupyterVariable) {
        console.log(item);
    }
    public async onViewDataFrameVariable(item: IJupyterVariable) {
        console.log(item);
        try {
            // tslint:disable: no-any
            const value = await this.pythonVariables.getValue(item, this.debugSession as any);
            const dataExplorer = this.serviceContainer.get<IDataViewer>(IDataViewer);
            // this.activeExplorers.push(dataExplorer);
            (dataExplorer as DataViewer).setDebugSession(this.debugSession);
            await dataExplorer.showVariable(value, this.debugSession as any);
            // return dataExplorer;

            console.log(value);
        } catch (ex) {
            console.error(ex);
        }
    }
}

// When a python debugging session is active keep track of the current debug location
export class DebugLocationTracker implements DebugAdapterTracker {
    public readonly frameIdAndSequence = new Map<number, number>();
    public readonly sequenceAndFrameId = new Map<number, number>();
    public readonly frameIdAndVariableRefs = new Map<number, number[]>();
    public readonly variableRefAndFrameId = new Map<number, number>();
    public readonly variables = new Map<number, IJupyterVariable>();
    public readonly variableRequestAndRef = new Map<number, number>();
    private waitingForStackTrace: boolean = false;
    private _debugLocation: IDebugLocation | undefined;
    private debugLocationUpdatedEvent: EventEmitter<void> = new EventEmitter<void>();
    private sessionEndedEmitter: EventEmitter<DebugLocationTracker> = new EventEmitter<DebugLocationTracker>();

    // tslint:disable-next-line: no-any
    constructor(private _sessionId: string, session: DebugSession, _appShell: IApplicationShell) {
        this.DebugLocation = undefined;
        DebugVariablesPanel.instance.debugSession = session;
    }

    public get sessionId() {
        return this._sessionId;
    }

    public get sessionEnded(): Event<DebugLocationTracker> {
        return this.sessionEndedEmitter.event;
    }

    public get debugLocationUpdated(): Event<void> {
        return this.debugLocationUpdatedEvent.event;
    }

    public get debugLocation(): IDebugLocation | undefined {
        return this._debugLocation;
    }
    // tslint:disable-next-line: no-any
    public onWillReceiveMessage?(message: any): void {
        const x = message;
        if (message.type === 'request' && message.command === 'scopes') {
            this.frameIdAndSequence.set(message.arguments.frameId, message.seq); //22 -> 42
            this.sequenceAndFrameId.set(message.seq, message.arguments.frameId); //42 -> 22
        }
        if (message.type === 'request' && message.command === 'variables') {
            this.variableRequestAndRef.set(message.seq, message.arguments.variablesReference); //22 -> 42
        }
    }
    // tslint:disable:no-any
    public onDidSendMessage(message: DebugProtocol.Response) {
        try {
            if (message.type === 'response' && message.command === 'scopes') {
                const frameId = this.sequenceAndFrameId.get(message.request_seq)!;
                const variablesReferences = message.body.scopes.map((scope: any) => scope.variablesReference);
                this.frameIdAndVariableRefs.set(frameId, variablesReferences);
                variablesReferences.forEach((variableRef: any) => this.variableRefAndFrameId.set(variableRef, frameId));
            }
            if (message.type === 'response' && message.command === 'variables') {
                const variablesReference = this.variableRequestAndRef.get(message.request_seq)!;
                const frameId = this.variableRefAndFrameId.get(variablesReference)!;
                message.body.variables.forEach((variable: any) => {
                    this.variables.set(variable.variablesReference, {
                        name: variable.name,
                        type: variable.type,
                        evaluateName: variable.evaluateName,
                        count: 0,
                        shape: '',
                        size: 0,
                        supportsDataExplorer: true,
                        truncated: false,
                        value: '',
                        variableReference: variable.variablesReference,
                        frameId
                    });
                    this.variableRefAndFrameId.set(variable.variablesReference, frameId);
                });

                DebugVariablesPanel.instance.treeDataProvider.refresh(Array.from(this.variables.values()));
            }
        } catch (ex) {
            console.error(ex);
        }
        if (this.isStopEvent(message)) {
            // Some type of stop, wait to see our next stack trace to find our location
            this.waitingForStackTrace = true;
        }

        if (this.isContinueEvent(message)) {
            // Running, clear the location
            this.DebugLocation = undefined;
            this.waitingForStackTrace = false;
        }

        if (this.waitingForStackTrace) {
            // If we are waiting for a stack track, check our messages for one
            const debugLoc = this.getStackTrace(message);
            if (debugLoc) {
                this.DebugLocation = debugLoc;
                this.waitingForStackTrace = false;
            }
        }
    }

    public onWillStopSession() {
        this.sessionEndedEmitter.fire(this);
    }

    // Set our new location and fire our debug event
    private set DebugLocation(newLocation: IDebugLocation | undefined) {
        const oldLocation = this._debugLocation;
        this._debugLocation = newLocation;

        if (this._debugLocation !== oldLocation) {
            this.debugLocationUpdatedEvent.fire();
        }
    }

    // tslint:disable-next-line:no-any
    private isStopEvent(message: DebugProtocol.ProtocolMessage) {
        if (message.type === 'event') {
            const eventMessage = message as DebugProtocol.Event;
            if (eventMessage.event === 'stopped') {
                return true;
            }
        }

        return false;
    }

    // tslint:disable-next-line:no-any
    private getStackTrace(message: DebugProtocol.ProtocolMessage): IDebugLocation | undefined {
        if (message.type === 'response') {
            const responseMessage = message as DebugProtocol.Response;
            if (responseMessage.command === 'stackTrace') {
                const messageBody = responseMessage.body;
                if (messageBody.stackFrames.length > 0) {
                    const lineNumber = messageBody.stackFrames[0].line;
                    const fileName = this.normalizeFilePath(messageBody.stackFrames[0].source.path);
                    const column = messageBody.stackFrames[0].column;
                    return { lineNumber, fileName, column };
                }
            }
        }

        return undefined;
    }

    private normalizeFilePath(path: string): string {
        // Make the path match the os. Debugger seems to return
        // invalid path chars on linux/darwin
        if (process.platform !== 'win32') {
            return path.replace(/\\/g, '/');
        }
        return path;
    }

    // tslint:disable-next-line:no-any
    private isContinueEvent(message: DebugProtocol.ProtocolMessage): boolean {
        if (message.type === 'event') {
            const eventMessage = message as DebugProtocol.Event;
            if (eventMessage.event === 'continue') {
                return true;
            }
        } else if (message.type === 'response') {
            const responseMessage = message as DebugProtocol.Response;
            if (responseMessage.command === 'continue') {
                return true;
            }
        }

        return false;
    }
}
