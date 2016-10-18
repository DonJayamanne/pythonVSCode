import { KernelspecMetadata, Kernelspec, ParsedIOMessage } from '../contracts';

export interface IJupyterClient {
    getAllKernelSpecs(): Promise<{ [key: string]: Kernelspec }>;
    startKernel(kernelSpec: KernelspecMetadata): Promise<[string, any, string]>;
    shutdownkernel(kernelUUID: string): Promise<any>;
    interruptKernel(kernelUUID: string): Promise<any>;
    restartKernel(kernelUUID: string): Promise<any>;
    runCode(code: string): Promise<string>;
    runCodeEx(code: string, onResults: Function): Promise<any>;
}

export enum KernelCommand {
    shutdown, restart, interrupt
}
