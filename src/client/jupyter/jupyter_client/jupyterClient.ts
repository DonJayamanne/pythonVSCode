import { iPythonAdapter } from './ipythonAdapter';
import { SocketServer } from '../../common/comms/socketServer';
import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { createDeferred, Deferred } from '../../common/helpers';

export class JupyterClient {
    constructor(private outputChannel: vscode.OutputChannel) {
    }

    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private ipythonAdapter: iPythonAdapter;
    public start(): Promise<any> {
        const pyFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'ipythonServer.py');
        return this.startSocketServer().then(port => {
            const def = createDeferred<any>();
            const newEnv = { "DEBUG_DJAYAMANNE_IPYTHON": "1" };
            Object.assign(newEnv, process.env);

            this.process = child_process.spawn('python', [pyFile, port.toString()], { env: newEnv });
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');

            let processStarted = false;
            let handshakeDone = false;
            let isInTestRun = process.env['PYTHON_DONJAYAMANNE_TEST'] === "1";
            const testDef = createDeferred<any>();
            const promiseToResolve = isInTestRun ? testDef.resolve.bind(testDef) : def.resolve.bind(def);

            this.process.stdout.on('data', (data: string) => {
                if (data.split(/\r?\n/g).some(line => line === 'Started')) {
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

            this.ipythonAdapter.on('handshake', () => {
                handshakeDone = true;
                if (processStarted && handshakeDone) {
                    promiseToResolve()
                }
            });

            // If we're testing, then test the ping and the pong
            if (isInTestRun) {
                testDef.promise.then(() => {
                    // Ok everything has started, now test ping
                    const msg1 = 'Hello world from Type Script - Функция проверки ИНН и КПП - 长城!1'
                    const msg2 = 'Hello world from Type Script - Функция проверки ИНН и КПП - 长城!2'
                    Promise.all<string>([this.ipythonAdapter.ping(msg1), this.ipythonAdapter.ping(msg2)]).then(msgs => {
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
        });
    }
    private startSocketServer(): Promise<number> {
        this.socketServer = new SocketServer();
        this.ipythonAdapter = new iPythonAdapter(this.socketServer);
        return this.socketServer.Start();
    }
}


// ipythonKernel -> ipython Socket handler -> socket server -> [ python readline process + python socket server ]
//                                                |                                             |
//                                                |                                             |
//                                                |                                             +-> python (threaded) code for jupyter
//                                                |                                             |
//                                                |                                             |
//                                                ^                                             +-> threaded loop check responses
//                                                |                                                             |
//                                                |                                                             |
//                                                +-------------------------------------------------------------+
