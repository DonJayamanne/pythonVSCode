import { Kernel } from './kernel';
import { KernelspecMetadata, ParsedIOMessage } from './contracts';
import { IJupyterClientAdapter } from './jupyter_client/contracts';
import * as Rx from 'rx';

export class JupyterClientKernel extends Kernel {
    constructor(kernelSpec: KernelspecMetadata, language: string, private connection: any, private connectionFile: string, private kernelUUID: string, private jupyterClient: IJupyterClientAdapter) {
        super(kernelSpec, language);
        this.jupyterClient.on('status', status => {
            this.raiseOnStatusChange(status);
        });
    }

    public dispose() {
        this.shutdown().catch(()=>{});
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

    public execute(code: string):Rx.IObservable<ParsedIOMessage> {
        return this.jupyterClient.runCode(code);
    };
}