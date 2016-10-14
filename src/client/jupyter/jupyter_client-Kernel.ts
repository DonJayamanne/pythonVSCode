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
import { IJupyterClient } from './jupyter_client/contracts';

const uuid = require('uuid');
const pythonSettings = settings.PythonSettings.getInstance();

export class JupyterClientKernel extends Kernel {
    private process: child_process.ChildProcess;
    private socketServer: SocketServer;
    private ipythonAdapter: iPythonAdapter;

    constructor(kernelSpec: KernelspecMetadata, language: string, private connection: any, private connectionFile: string, private kernelUUID: string, private jupyterClient: IJupyterClient) {
        super(kernelSpec, language);
    }

    private shutdownPromise: Promise<any>;
    public dispose() {
        this.shutdown();
        super.dispose();
    };

    public interrupt(): any {
        this.jupyterClient.interruptKernel(this.kernelUUID);
    };

    public shutdown(restart?: boolean): Promise<any> {
        if (restart === true) {
            return this.jupyterClient.restartKernel(this.kernelUUID);
        }
        return this.jupyterClient.shutdownkernel(this.kernelUUID);
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