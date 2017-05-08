"use strict";

import { SocketClient } from './socketClient';
import { SocketServer } from '../common/comms/socketServer';
import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { createDeferred, Deferred } from '../common/helpers';
import { IClientAdapter } from './IClientAdapter';
import { PythonSettings } from '../common/configSettings';
import { EventEmitter } from 'events';
import { formatErrorForLogging } from '../common/utils';
import { TextDocument, Position, CancellationToken } from 'vscode';
import { CompletionItem, Definition, Hover, ReferenceContext, Location, SignatureHelp, SymbolInformation } from 'vscode';
import { Commands } from "./commands";
import { CompletionParser } from './parsers/CompletionParser';
import { DefinitionParser } from './parsers/DefinitionParser';
import { HoverParser } from './parsers/HoverParser';
import { LocationParser } from './parsers/LocationParser';
import { SignatureHelpParser } from './parsers/SignatureHelpParser';
import { SymbolInformationParser } from './parsers/SymbolInformationParser';

export class ClientAdapter extends EventEmitter implements IClientAdapter {
    constructor(private outputChannel: vscode.OutputChannel, private rootDir: string) {
        super();
    }

    public getCompletions(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<CompletionItem[]> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(CompletionParser.parse);
    }
    public getDefinition(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Definition> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(DefinitionParser.parse);
    }
    public getHoverDefinition(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Hover> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(HoverParser.parse);
    }
    public getReferences(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<Location[]> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(DefinitionParser.parse);
    }
    public getSignature(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<SignatureHelp> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(SignatureHelpParser.parse);
    }
    public getDocumentSymbols(token: CancellationToken, fileName: string, columnIndex: number, lineIndex: number, source: string): Promise<SymbolInformation[]> {
        return this.socketClient.getResult<any>(Commands.Completions, token, fileName, columnIndex, lineIndex, source)
            .then(SymbolInformationParser.parse);
    }

    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private socketClient: SocketClient;

    private startDef: Deferred<any>;

    public dispose() {
        try {
            if (this.process) {
                this.process.stdin.write('\n');
            }
        }
        catch (ex) {
        }
        try {
            this.socketClient.dispose();
        }
        catch (ex) {
        }
        try {
            this.socketServer.Stop();
        }
        catch (ex) {
        }
        this.socketClient = null;
        this.process = null;
        this.socketServer = null;
        this.startDef = null;
    }
    public start(envVariables?: { [key: string]: string }): Promise<any> {
        if (this.startDef) {
            return this.startDef.promise;
        }

        this.startDef = createDeferred<any>();
        const pyFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'completionServer.py');
        const newEnv = {};
        // const newEnv = {'DEBUG_DJAYAMANNE_IPYTHON':'1'};
        Object.assign(newEnv, envVariables);
        Object.assign(newEnv, process.env);

        this.startSocketServer().then(port => {
            const def = createDeferred<any>();
            const options = { env: newEnv, cwd: this.rootDir };
            this.process = child_process.spawn(PythonSettings.getInstance().pythonPath, [pyFile, port.toString()], options);
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');

            let processStarted = false;
            let handshakeDone = false;
            let isInTestRun = newEnv['PYTHON_DONJAYAMANNE_TEST'] === "1";
            const testDef = createDeferred<any>();
            const promiseToResolve = isInTestRun ? testDef.resolve.bind(testDef) : def.resolve.bind(def);

            this.process.stdout.on('data', (data: string) => {
                if (!processStarted && data.split(/\r?\n/g).some(line => line === 'Started')) {
                    processStarted = true;
                    if (processStarted && handshakeDone) {
                        promiseToResolve();
                    }
                    return;
                }
                this.outputChannel.append(data);
            });
            this.process.stderr.on('data', (data: string) => {
                this.outputChannel.append(data);
            });

            this.socketClient.on('handshake', () => {
                handshakeDone = true;
                if (processStarted && handshakeDone) {
                    promiseToResolve();
                }
            });

            // If we're testing, then test the ping and the pong
            // TODO: Better way to test sockets
            if (isInTestRun) {
                testDef.promise.then(() => {
                    // Ok everything has started, now test ping
                    const msg1 = 'Hello world from Type Script - Функция проверки ИНН и КПП - 长城!1';
                    const msg2 = 'Hello world from Type Script - Функция проверки ИНН и КПП - 长城!2';
                    Promise.all<string, string>([this.socketClient.ping(msg1), this.socketClient.ping(msg2)]).then(msgs => {
                        if (msgs.indexOf(msg1) === -1 || msgs.indexOf(msg2) === -1) {
                            def.reject('msg1 or msg2 not returned');
                        }
                        else {
                            def.resolve();
                        }
                    }).catch(reason => def.reject(reason));
                });
            }

            return def.promise;
        }).then(() => {
            this.startDef.resolve();
        }).catch(reason => {
            this.startDef.reject(reason);
        });

        return this.startDef.promise;
    }
    private startSocketServer(): Promise<number> {
        this.socketServer = new SocketServer();
        this.socketClient = new SocketClient(this.socketServer, this.outputChannel);
        this.socketClient.on('status', status => {
            this.emit('status', status);
        });
        this.socketClient.on('error', error => {
            this.emit('error', error);
            console.error(error);
            this.outputChannel.appendLine('Error received: ' + error);
        });
        this.socketClient.on('commanderror', (commandError: { command: string, id: string, trace: string }) => {
            this.outputChannel.appendLine(`Unhandled command Error from Jupyter. '${JSON.stringify(commandError)}'`);
        });
        return this.socketServer.Start();
    }

    public getAllKernelSpecs(): Promise<{ [key: string]: Kernelspec }> {
        return this.start().then(() => this.socketClient.listKernelSpecs());
    }
    private lastStartedKernelUUID: string;
    public startKernel(kernelSpec: KernelspecMetadata): Promise<[string, any, string]> {
        return this.start().then(() => this.getAllKernelSpecs()).then(specks => {
            // ok given the specks, find the name of the kernelspec
            const kernelSpecName = Object.keys(specks).find(kernelSpecName => {
                const spec = specks[kernelSpecName];
                return spec.spec.display_name === kernelSpec.display_name;
            });
            return this.socketClient.startKernel(kernelSpecName).then(info => {
                this.lastStartedKernelUUID = info[0];
                return info;
            });
        });
    }
    public shutdownkernel(kernelUUID: string): Promise<any> {
        return this.start().then(() => this.socketClient.sendKernelCommand(kernelUUID, KernelCommand.shutdown));
    }
    public interruptKernel(kernelUUID: string): Promise<any> {
        return this.start().then(() => this.socketClient.sendKernelCommand(kernelUUID, KernelCommand.interrupt));
    }
    public restartKernel(kernelUUID: string): Promise<any> {
        return this.start().then(() => this.socketClient.sendKernelCommand(kernelUUID, KernelCommand.restart));
    }
    public runCode(code: string): Rx.IObservable<ParsedIOMessage> {
        const subject = new Rx.Subject<ParsedIOMessage>();
        this.start().then(() => {
            const runnerObservable = this.socketClient.runCode(code);
            runnerObservable.subscribe(data => {
                subject.onNext(data);
            }, reason => {
                subject.onError(reason);
            }, () => {
                subject.onCompleted();
            });
        }).catch(reason => {
            subject.onError(reason);
        });

        return subject;
    }
}
