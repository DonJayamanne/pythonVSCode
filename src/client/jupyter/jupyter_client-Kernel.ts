import { Kernel } from './kernel';
import { KernelspecMetadata, JupyterMessage } from './contracts';
import { IJupyterClient } from './jupyter_client/contracts';
import { EventEmitter } from 'events';

export class JupyterClientKernel extends Kernel {
    constructor(kernelSpec: KernelspecMetadata, language: string, private connection: any, private connectionFile: string, private kernelUUID: string, private jupyterClient: IJupyterClient) {
        super(kernelSpec, language);
        ((this.jupyterClient as any) as EventEmitter).on('status', status => {
            this.raiseOnStatusChange(status);
        });
    }

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
        this.jupyterClient.runCodeEx(code, (data) => {
            onResults(data);
        });
    };

    public executeWatch(code: string, onResults: Function) {
    };

    public complete(code: string, onResults: Function) {
    };

    public inspect(code: string, cursor_pos, onResults: Function) {
    };
}