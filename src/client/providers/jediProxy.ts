'use strict';

import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './../common/configSettings';
import * as logger from './../common/logger';
import * as telemetryHelper from "../common/telemetry";
import { execPythonFile, validatePath } from "../common/utils";

const IS_WINDOWS = /^win/.test(process.platform);
var proc: child_process.ChildProcess;
var pythonSettings = settings.PythonSettings.getInstance();

const pythonVSCodeTypeMappings = new Map<string, vscode.CompletionItemKind>();
pythonVSCodeTypeMappings.set('none', vscode.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('type', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('tuple', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dict', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictionary', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('function', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('lambda', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('generator', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('class', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('instance', vscode.CompletionItemKind.Reference);
pythonVSCodeTypeMappings.set('method', vscode.CompletionItemKind.Method);
pythonVSCodeTypeMappings.set('builtin', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('builtinfunction', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('module', vscode.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('file', vscode.CompletionItemKind.File);
pythonVSCodeTypeMappings.set('xrange', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('slice', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('traceback', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('frame', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('buffer', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('dictproxy', vscode.CompletionItemKind.Class);
pythonVSCodeTypeMappings.set('funcdef', vscode.CompletionItemKind.Function);
pythonVSCodeTypeMappings.set('property', vscode.CompletionItemKind.Property);
pythonVSCodeTypeMappings.set('import', vscode.CompletionItemKind.Module);
pythonVSCodeTypeMappings.set('keyword', vscode.CompletionItemKind.Keyword);
pythonVSCodeTypeMappings.set('constant', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('variable', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('value', vscode.CompletionItemKind.Value);
pythonVSCodeTypeMappings.set('param', vscode.CompletionItemKind.Variable);
pythonVSCodeTypeMappings.set('statement', vscode.CompletionItemKind.Keyword);

const pythonVSCodeSymbolMappings = new Map<string, vscode.SymbolKind>();
pythonVSCodeSymbolMappings.set('none', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('type', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('tuple', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dict', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('dictionary', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('function', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('lambda', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('generator', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('class', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('instance', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('method', vscode.SymbolKind.Method);
pythonVSCodeSymbolMappings.set('builtin', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('builtinfunction', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('module', vscode.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('file', vscode.SymbolKind.File);
pythonVSCodeSymbolMappings.set('xrange', vscode.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('slice', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('traceback', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('frame', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('buffer', vscode.SymbolKind.Array);
pythonVSCodeSymbolMappings.set('dictproxy', vscode.SymbolKind.Class);
pythonVSCodeSymbolMappings.set('funcdef', vscode.SymbolKind.Function);
pythonVSCodeSymbolMappings.set('property', vscode.SymbolKind.Property);
pythonVSCodeSymbolMappings.set('import', vscode.SymbolKind.Module);
pythonVSCodeSymbolMappings.set('keyword', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('constant', vscode.SymbolKind.Constant);
pythonVSCodeSymbolMappings.set('variable', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('value', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('param', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('statement', vscode.SymbolKind.Variable);
pythonVSCodeSymbolMappings.set('boolean', vscode.SymbolKind.Boolean);
pythonVSCodeSymbolMappings.set('int', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('longlean', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('float', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('complex', vscode.SymbolKind.Number);
pythonVSCodeSymbolMappings.set('string', vscode.SymbolKind.String);
pythonVSCodeSymbolMappings.set('unicode', vscode.SymbolKind.String);
pythonVSCodeSymbolMappings.set('list', vscode.SymbolKind.Array);

function getMappedVSCodeType(pythonType: string): vscode.CompletionItemKind {
    if (pythonVSCodeTypeMappings.has(pythonType)) {
        return pythonVSCodeTypeMappings.get(pythonType);
    }
    else {
        return vscode.CompletionItemKind.Keyword;
    }
}

function getMappedVSCodeSymbol(pythonType: string): vscode.SymbolKind {
    if (pythonVSCodeSymbolMappings.has(pythonType)) {
        return pythonVSCodeSymbolMappings.get(pythonType);
    }
    else {
        return vscode.SymbolKind.Variable;
    }
}

export enum CommandType {
    Arguments,
    Completions,
    Usages,
    Definitions,
    Symbols
}

var commandNames = new Map<CommandType, string>();
commandNames.set(CommandType.Arguments, "arguments");
commandNames.set(CommandType.Completions, "completions");
commandNames.set(CommandType.Definitions, "definitions");
commandNames.set(CommandType.Usages, "usages");
commandNames.set(CommandType.Symbols, "names");

export class JediProxy extends vscode.Disposable {
    public constructor(context: vscode.ExtensionContext) {
        super(killProcess);

        context.subscriptions.push(this);
        initialize(context.asAbsolutePath("."));
    }

    private cmdId: number = 0;

    public getNextCommandId(): number {
        return this.cmdId++;
    }
    public sendCommand<T extends ICommandResult>(cmd: ICommand<T>): Promise<T> {
        return sendCommand(cmd);
    }
}

// keep track of the directory so we can re-spawn the process
let pythonProcessCWD = "";
function initialize(dir: string) {
    pythonProcessCWD = dir;
    spawnProcess(path.join(dir, "pythonFiles"));
}

// Check if settings changes
let lastKnownPythonInterpreter = pythonSettings.pythonPath;
pythonSettings.on('change', onPythonSettingsChanged);

function onPythonSettingsChanged() {
    if (lastKnownPythonInterpreter === pythonSettings.pythonPath) {
        return;
    }
    killProcess();
    clearPendingRequests();
    initialize(pythonProcessCWD);
}

function clearPendingRequests() {
    commandQueue = [];
    commands.forEach(item => {
        item.resolve();
    });
    commands.clear();
}
var previousData = "";
var commands = new Map<number, IExecutionCommand<ICommandResult>>();
var commandQueue: number[] = [];

function killProcess() {
    try {
        if (proc) {
            proc.kill();
        }
    }
    catch (ex) { }
    proc = null;
}

function handleError(source: string, errorMessage: string) {
    logger.error(source + ' jediProxy', `Error (${source}) ${errorMessage}`);
}

function spawnProcess(dir: string) {
    try {
        let environmentVariables = { 'PYTHONUNBUFFERED': '1' };
        for (let setting in process.env) {
            if (!environmentVariables[setting]) {
                environmentVariables[setting] = process.env[setting];
            }
        }

        logger.log('child_process.spawn in jediProxy', 'Value of pythonSettings.pythonPath is :' + pythonSettings.pythonPath);
        proc = child_process.spawn(pythonSettings.pythonPath, ["completion.py"], {
            cwd: dir,
            env: environmentVariables
        });
    }
    catch (ex) {
        return handleError("spawnProcess", ex.message);
    }
    proc.stderr.setEncoding('utf8');
    proc.stderr.on("data", (data: string) => {
        handleError("stderr", data);
    });
    proc.on("end", (end) => {
        logger.error('spawnProcess.end', "End - " + end);
    });
    proc.on("error", error => {
        handleError("error", error);
    });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on("data", (data: string) => {
        //Possible there was an exception in parsing the data returned
        //So append the data then parse it
        var dataStr = previousData = previousData + data + ""
        var responses: any[];
        try {
            responses = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            previousData = "";
        }
        catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            // Don't log errors when we haven't received the entire response
            if (ex.message !== 'Unexpected end of input') {
                handleError("stdout", ex.message);
            }
            return;
        }

        responses.forEach((response) => {
            // What's this, can't remember,
            // Great example of poorly written code (this whole file is a mess)
            // I think this needs to be removed, because this is misspelt, it is argments, 'U' is missing
            // And that case is handled further down
            // case CommandType.Arguments: {
            // Rewrite this mess to use stratergy..
            if (response["argments"]) {
                var index = commandQueue.indexOf(cmd.id);
                commandQueue.splice(index, 1);
                return;
            }
            var responseId = <number>response["id"];

            var cmd = <IExecutionCommand<ICommandResult>>commands.get(responseId);
            if (typeof cmd === "object" && cmd !== null) {
                commands.delete(responseId);
                var index = commandQueue.indexOf(cmd.id);
                commandQueue.splice(index, 1);

                if (cmd.delays) {
                    cmd.delays.stop();
                    telemetryHelper.sendTelemetryEvent(cmd.telemetryEvent, null, cmd.delays.toMeasures());
                }

                // Check if this command has expired
                if (cmd.token.isCancellationRequested) {
                    return;
                }

                switch (cmd.command) {
                    case CommandType.Completions: {
                        let results = <IAutoCompleteItem[]>response['results'];
                        results = Array.isArray(results) ? results : [];
                        results.forEach(item => {
                            const originalType = <string><any>item.type;
                            item.type = getMappedVSCodeType(originalType);
                            item.kind = getMappedVSCodeSymbol(originalType);
                        });

                        let completionResult: ICompletionResult = {
                            items: results,
                            requestId: cmd.id
                        }
                        cmd.resolve(completionResult);
                        break;
                    }
                    case CommandType.Definitions: {
                        let defs = <any[]>response['results'];
                        let defResult: IDefinitionResult = {
                            requestId: cmd.id,
                            definition: null
                        };
                        if (defs.length > 0) {
                            let def = defs[0];
                            const originalType = def.type as string;
                            defResult.definition = {
                                columnIndex: Number(def.column),
                                fileName: def.fileName,
                                lineIndex: Number(def.line),
                                text: def.text,
                                type: getMappedVSCodeType(originalType),
                                kind: getMappedVSCodeSymbol(originalType)
                            };
                        }

                        cmd.resolve(defResult);
                        break;
                    }
                    case CommandType.Symbols: {
                        var defs = <any[]>response['results'];
                        defs = Array.isArray(defs) ? defs : [];
                        var defResults: ISymbolResult = {
                            requestId: cmd.id,
                            definitions: []
                        }
                        defResults.definitions = defs.map(def => {
                            const originalType = def.type as string;
                            return <IDefinition>{
                                columnIndex: <number>def.column,
                                fileName: <string>def.fileName,
                                lineIndex: <number>def.line,
                                text: <string>def.text,
                                type: getMappedVSCodeType(originalType),
                                kind: getMappedVSCodeSymbol(originalType)
                            };
                        });

                        cmd.resolve(defResults);
                        break;
                    }
                    case CommandType.Usages: {
                        var defs = <any[]>response['results'];
                        defs = Array.isArray(defs) ? defs : [];
                        var refResult: IReferenceResult = {
                            requestId: cmd.id,
                            references: defs.map(item => {
                                return {
                                    columnIndex: item.column,
                                    fileName: item.fileName,
                                    lineIndex: item.line - 1,
                                    moduleName: item.moduleName,
                                    name: item.name
                                };
                            }
                            )
                        };

                        cmd.resolve(refResult);
                        break;
                    }
                    case CommandType.Arguments: {
                        let defs = <any[]>response["results"];
                        cmd.resolve(<IArgumentsResult>{
                            requestId: cmd.id,
                            definitions: defs
                        });
                        break;
                    }
                }
            }

            //Ok, check if too many pending requets
            if (commandQueue.length > 10) {
                var items = commandQueue.splice(0, commandQueue.length - 10);
                items.forEach(id => {
                    if (commands.has(id)) {
                        commands.delete(id);
                    }
                })
            }
        });
    });
}

function sendCommand<T extends ICommandResult>(cmd: ICommand<T>): Promise<T> {
    return new Promise<ICommandResult>((resolve, reject) => {
        if (!proc) {
            return reject("Python proc not initialized");
        }
        var exexcutionCmd = <IExecutionCommand<T>>cmd;
        var payload = createPayload(exexcutionCmd);
        exexcutionCmd.resolve = resolve;
        exexcutionCmd.reject = reject;
        exexcutionCmd.delays = new telemetryHelper.Delays();
        try {
            proc.stdin.write(JSON.stringify(payload) + "\n");
            commands.set(exexcutionCmd.id, exexcutionCmd);
            commandQueue.push(exexcutionCmd.id);
        }
        catch (ex) {
            //If 'This socket is closed.' that means process didn't start at all (at least not properly)
            if (ex.message === "This socket is closed.") {
                killProcess();
            }
            else {
                handleError("sendCommand", ex.message);
            }
            reject(ex.message);
        }
    });
}

function createPayload<T extends ICommandResult>(cmd: IExecutionCommand<T>): any {
    var payload = {
        id: cmd.id,
        prefix: "",
        lookup: commandNames.get(cmd.command),
        path: cmd.fileName,
        source: cmd.source,
        line: cmd.lineIndex,
        column: cmd.columnIndex,
        config: getConfig()
    };

    if (cmd.command === CommandType.Symbols) {
        delete payload.column;
        delete payload.line;
    }

    return payload;
}

let lastKnownPythonPath: string = null;
let additionalAutoCopletePaths: string[] = [];
function getPathFromPythonCommand(args: string[]): Promise<string> {
    return execPythonFile(pythonSettings.pythonPath, args, vscode.workspace.rootPath).then(stdout => {
        if (stdout.length === 0) {
            return "";
        }
        let lines = stdout.split(/\r?\n/g).filter(line => line.length > 0);
        return validatePath(lines[0]);
    }).catch(() => {
        return "";
    });
}
vscode.workspace.onDidChangeConfiguration(onConfigChanged);
onConfigChanged();
function onConfigChanged() {
    // We're only interested in changes to the python path
    if (lastKnownPythonPath === pythonSettings.pythonPath) {
        return;
    }

    lastKnownPythonPath = pythonSettings.pythonPath;
    let filePaths = [
        // Sysprefix
        getPathFromPythonCommand(["-c", "import sys;print(sys.prefix)"]),
        // exeucutable path
        getPathFromPythonCommand(["-c", "import sys;print(sys.executable)"]),
        // Python specific site packages
        getPathFromPythonCommand(["-c", "from distutils.sysconfig import get_python_lib; print(get_python_lib())"]),
        // Python global site packages, as a fallback in case user hasn't installed them in custom environment
        getPathFromPythonCommand(["-m", "site", "--user-site"]),
    ];

    const pythonPath: string = process.env['PYTHONPATH'];
    if (typeof pythonPath === 'string' && pythonPath.length > 0) {
        filePaths.push(Promise.resolve(pythonPath.trim()));
    }
    Promise.all<string>(filePaths).then(paths => {
        // Last item return a path, we need only the folder
        if (paths[1].length > 0) {
            paths[1] = path.dirname(paths[1]);
        }

        // On windows we also need the libs path (second item will return c:\xxx\lib\site-packages)
        // This is returned by "from distutils.sysconfig import get_python_lib; print(get_python_lib())"
        if (IS_WINDOWS && paths[2].length > 0) {
            paths.splice(3, 0, path.join(paths[2], ".."));
        }
        additionalAutoCopletePaths = paths.filter(p => p.length > 0);
    });
}

function getConfig() {
    // Add support for paths relative to workspace
    let extraPaths = pythonSettings.autoComplete.extraPaths.map(extraPath => {
        if (path.isAbsolute(extraPath)) {
            return extraPath;
        }
        return path.join(vscode.workspace.rootPath, extraPath);
    });

    // Always add workspace path into extra paths
    extraPaths.unshift(vscode.workspace.rootPath);

    let distinctExtraPaths = extraPaths.concat(additionalAutoCopletePaths).filter((value, index, self) => self.indexOf(value) === index);
    return {
        extraPaths: distinctExtraPaths,
        useSnippets: false,
        caseInsensitiveCompletion: true,
        showDescriptions: true,
        fuzzyMatcher: true
    };
}

export interface ICommand<T extends ICommandResult> {
    telemetryEvent: string;
    command: CommandType;
    source?: string;
    fileName: string;
    lineIndex: number;
    columnIndex: number;
}

interface IExecutionCommand<T extends ICommandResult> extends ICommand<T> {
    id?: number;
    resolve: (value?: T) => void
    reject: (ICommandError) => void;
    token: vscode.CancellationToken;
    delays: telemetryHelper.Delays;
}

export interface ICommandError {
    message: string
}

export interface ICommandResult {
    requestId: number
}
export interface ICompletionResult extends ICommandResult {
    items: IAutoCompleteItem[];
}
export interface IDefinitionResult extends ICommandResult {
    definition: IDefinition;
}
export interface IReferenceResult extends ICommandResult {
    references: IReference[];
}
export interface ISymbolResult extends ICommandResult {
    definitions: IDefinition[];
}
export interface IArgumentsResult extends ICommandResult {
    definitions: ISignature[];
}

export interface ISignature {
    name: string;
    docstring: string;
    description: string;
    paramindex: number;
    params: IArgument[];
}
export interface IArgument {
    name: string;
    value: string;
    docstring: string;
    description: string;
}

export interface IReference {
    name: string,
    fileName: string,
    columnIndex: number,
    lineIndex: number,
    moduleName: string
}

export interface IAutoCompleteItem {
    type: vscode.CompletionItemKind;
    kind: vscode.SymbolKind;
    text: string;
    description: string;
    rightLabel: string;
}
export interface IDefinition {
    type: vscode.CompletionItemKind;
    kind: vscode.SymbolKind;
    text: string;
    fileName: string;
    columnIndex: number;
    lineIndex: number;
}

let jediProxy_singleton: JediProxy = null;

export class JediProxyHandler<R extends ICommandResult, T> {
    private jediProxy: JediProxy;
    private defaultCallbackData: T;

    private lastToken: vscode.CancellationToken;
    private lastCommandId: number;
    private promiseResolve: (value?: T) => void;
    private parseResponse: (data: R) => T;
    private cancellationTokenSource: vscode.CancellationTokenSource;

    public get JediProxy(): JediProxy {
        return this.jediProxy;
    }

    public constructor(context: vscode.ExtensionContext, defaultCallbackData: T, parseResponse: (data: R) => T, jediProxy: JediProxy = null) {
        if (jediProxy) {
            this.jediProxy = jediProxy;
        }
        else {
            if (pythonSettings.devOptions.indexOf("SINGLE_JEDI") >= 0) {
                if (jediProxy_singleton === null) {
                    jediProxy_singleton = new JediProxy(context);
                }
                this.jediProxy = jediProxy_singleton;
            }
            else {
                this.jediProxy = new JediProxy(context);
            }
        }
        this.defaultCallbackData = defaultCallbackData;
        this.parseResponse = parseResponse;
    }

    public sendCommand(cmd: ICommand<R>, resolve: (value: T) => void, token?: vscode.CancellationToken) {
        var executionCmd = <IExecutionCommand<R>>cmd;
        executionCmd.id = executionCmd.id || this.jediProxy.getNextCommandId();

        if (this.cancellationTokenSource) {
            try {
                this.cancellationTokenSource.cancel();
            }
            catch (ex) { }
        }

        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        executionCmd.token = this.cancellationTokenSource.token;

        this.jediProxy.sendCommand<R>(executionCmd).then(data => this.onResolved(data), () => { });
        this.lastCommandId = executionCmd.id;
        this.lastToken = token;
        this.promiseResolve = resolve;
    }

    private onResolved(data: R) {
        if (this.lastToken.isCancellationRequested || !data || data.requestId !== this.lastCommandId) {
            this.promiseResolve(this.defaultCallbackData);
        }
        if (data) {
            this.promiseResolve(this.parseResponse(data));
        }
        else {
            this.promiseResolve(this.defaultCallbackData);
        }
    }
}
