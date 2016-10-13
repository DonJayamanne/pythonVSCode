import { iPythonAdapter } from './ipythonAdapter';
import { SocketServer } from '../../common/comms/socketServer';
import * as child_process from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

export class Main {
    constructor(private outputChannel: vscode.OutputChannel) {
    }

    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private ipythonAdapter: iPythonAdapter;

    public start() {
        const pyFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'ipythonServer.py');
        this.startSocketServer().then(port => {
            const newEnv = { "DEBUG_DJAYAMANNE_IPYTHON": "1" };
            Object.assign(newEnv, process.env);
            this.process = child_process.spawn('python3', [pyFile, port.toString()], { env: newEnv });
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');
            this.process.stdout.on('data', (data: string) => {
                this.outputChannel.append(data);
            });
            this.process.stderr.on('data', (data: string) => {
                this.outputChannel.append(data);
            });

            setTimeout(() => {
                //this.socketServer.
                this.ipythonAdapter.ping();
            }, 10000);
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
