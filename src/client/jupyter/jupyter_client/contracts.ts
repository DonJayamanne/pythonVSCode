import { KernelspecMetadata, Kernelspec } from '../contracts';

export interface IJupyterClient {
    getAllKernelSpecs(): Promise<{ [key: string]: Kernelspec }>;
    startKernel(kernelSpec: KernelspecMetadata): Promise<[string, any, string]>;
    shutdownkernel(kernelUUID: string): Promise<any>;
    interruptKernel(kernelUUID: string): Promise<any>;
    restartKernel(kernelUUID: string): Promise<any>;
}

export enum KernelCommand {
    shutdown,restart,interrupt
}
