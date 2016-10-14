import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Kernel } from './kernel';
import * as vscode from 'vscode';
import { KernelspecMetadata, JupyterMessage } from './contracts';
import { iPythonAdapter } from './jupyter_client/ipythonAdapter';
import { SocketServer } from '../common/comms/socketServer';
import { createDeferred } from '../common/helpers';
import * as settings from '../common/configSettings';

const uuid = require('uuid');
const pythonSettings = settings.PythonSettings.getInstance();

export class JupyterClientKernel extends Kernel {
    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private ipythonAdapter: iPythonAdapter;

    constructor(kernelSpec: KernelspecMetadata, language: string, private connection: any, private connectionFile: string, public kernelProcess?: child_process.ChildProcess) {
        super(kernelSpec, language);
    }

    public start() {
        const pyFile = path.join(__dirname, '..', '..', '..', 'pythonFiles', 'PythonTools', 'ipythonServer.py');
        this.startSocketServer().then(port => {
            const def = createDeferred<any>();
            const newEnv = { "DEBUG_DJAYAMANNE_IPYTHON": "1" };
            Object.assign(newEnv, process.env);
            this.process = child_process.spawn(pythonSettings.pythonPath, [pyFile, port.toString()], { env: newEnv });
            this.process.stdout.setEncoding('utf8');
            this.process.stderr.setEncoding('utf8');

            this.process.stdout.on('data', (data: string) => {
                //this.outputChannel.append(data);
            });
            this.process.stderr.on('data', (data: string) => {
                //this.outputChannel.append(data);
            });
        });
    }
    private startSocketServer(): Promise<number> {
        this.socketServer = new SocketServer();
        this.ipythonAdapter = new iPythonAdapter(this.socketServer);
        return this.socketServer.Start();
    }

    public interrupt(): any {
    };

    public shutdown(restart?: boolean) {
    };

    public execute(code: string, onResults: Function) {
    };

    public executeWatch(code: string, onResults: Function) {
    };

    public complete(code: string, onResults: Function) {
    };

    public inspect(code: string, cursor_pos, onResults: Function) {
    };
}