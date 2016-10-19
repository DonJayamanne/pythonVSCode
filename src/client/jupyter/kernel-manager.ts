import * as os from 'os';
import * as vscode from 'vscode';
import { Kernel } from './kernel';
import { KernelspecMetadata, Kernelspec } from './contracts';
import { Commands } from '../common/constants';
import { EventEmitter } from 'events';
import { PythonSettings } from '../common/configSettings';
import { formatErrorForLogging } from '../common/utils';
import { JupyterClientAdapter } from './jupyter_client/main';
import { JupyterClientKernel } from './jupyter_client-Kernel';
import { KernelRestartedError, KernelShutdownError } from './common/errors';

const pythonSettings = PythonSettings.getInstance();

export class KernelManagerImpl extends EventEmitter {
    private _runningKernels: Map<string, Kernel>;
    private _kernelSpecs: { [key: string]: Kernelspec };
    private disposables: vscode.Disposable[];
    constructor(private outputChannel: vscode.OutputChannel, private jupyterClient: JupyterClientAdapter) {
        super();
        this.disposables = [];
        this._runningKernels = new Map<string, Kernel>();
        this._kernelSpecs = {};
        this.registerCommands();
    }

    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Get_All_KernelSpecs_For_Language, this.getAllKernelSpecsFor.bind(this)));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.StartKernelForKernelSpeck, this.startKernel.bind(this)));
    }
    public dispose() {
        this._runningKernels.forEach(kernel => {
            kernel.dispose();
        });
        this._runningKernels.clear();
        this.jupyterClient.dispose();
    }

    public setRunningKernelFor(language: string, kernel: Kernel) {
        kernel.kernelSpec.language = language;
        this._runningKernels.set(language, kernel);
        this.emit('kernelChanged', kernel, language);
        return kernel;
    }

    public destroyRunningKernelFor(language: string) {
        if (!this._runningKernels.has(language)) {
            return;
        }
        const kernel = this._runningKernels.get(language);
        this._runningKernels.delete(language);
        if (kernel) {
            kernel.dispose();
        }
    }

    public restartRunningKernelFor(language: string): Promise<Kernel> {
        const kernel = this._runningKernels.get(language);
        let startupPromise: Promise<Kernel>;
        // if (kernel instanceof WSKernel) {
        //     startupPromise = new Promise<Kernel>((resolve, reject) => {
        //         kernel.restart().then(() => {
        //             resolve(kernel);
        //         }, reject.bind(this));
        //     });
        // }
        if (kernel instanceof JupyterClientKernel) {
            startupPromise = kernel.shutdown(true).then(() => kernel);
        }
        if (!startupPromise) {
            vscode.window.showWarningMessage('Cannot restart this kernel');
            startupPromise = Promise.resolve(kernel);
        }

        return startupPromise.catch(reason => {
            let message = 'Failed to start the kernel.';
            if (reason && reason.message) {
                message = reason.message;
            }
            vscode.window.showErrorMessage(message);
            this.outputChannel.appendLine(formatErrorForLogging(reason));
            return Promise.reject(reason);
        });
    }

    public startKernelFor(language: string): Promise<Kernel> {
        return this.getKernelSpecFor(language).then(kernelSpec => {
            return this.startKernel(kernelSpec, language);
        });
    }

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel> {
        throw new Error('Start Existing Kernel not implemented');
    }

    public startKernel(kernelSpec: KernelspecMetadata, language: string): Promise<Kernel> {
        this.destroyRunningKernelFor(language);
        return this.jupyterClient.startKernel(kernelSpec).then((kernelInfo: [string, any, string]) => {
            const kernelUUID = kernelInfo[0];
            const config = kernelInfo[1];
            const connectionFile = kernelInfo[2];
            const kernel = new JupyterClientKernel(kernelSpec, language, config, connectionFile, kernelUUID, this.jupyterClient);
            this.setRunningKernelFor(language, kernel);
            return this.executeStartupCode(kernel).then(() => kernel);
        });
    }

    private executeStartupCode(kernel: Kernel): Promise<any> {
        if (pythonSettings.jupyter.startupCode.length === 0) {
            return Promise.resolve();
        }
        const suffix = ' ' + os.EOL;
        let startupCode = pythonSettings.jupyter.startupCode.join(suffix) + suffix;
        return new Promise<any>((resolve, reject) => {
            let errorMessage = 'Failed to execute kernel startup code. ';
            kernel.execute(startupCode).subscribe(result => {
                if (result.stream === 'error' && result.type === 'text' && typeof result.message === 'string') {
                    errorMessage += 'Details: ' + result.message;
                }
                if (result.stream === 'status' && result.type === 'text' && result.data === 'error') {
                    this.outputChannel.appendLine(errorMessage);
                    vscode.window.showWarningMessage(errorMessage);
                }
            }, reason => {
                if (reason instanceof KernelRestartedError || reason instanceof KernelShutdownError) {
                    return resolve();
                }
                // It doesn't matter if startup code execution Failed
                // Possible they have placed some stuff that is invalid or we have some missing packages (e.g. matplot lib)
                this.outputChannel.appendLine(formatErrorForLogging(reason));
                vscode.window.showWarningMessage(errorMessage);
                resolve();
            }, () => {
                resolve();
            });
        });
    }

    public getAllRunningKernels() {
        return this._runningKernels;
    }

    public getRunningKernelFor(language: string) {
        return this._runningKernels.has(language) ? this._runningKernels.get(language) : null;
    }

    public getAllKernelSpecs(): Promise<KernelspecMetadata[]> {
        if (Object.keys(this._kernelSpecs).length === 0) {
            return this.updateKernelSpecs().then(() => {
                return Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key].spec);
            });
        } else {
            const result = Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key].spec);
            return Promise.resolve(result);
        }
    }

    public getAllKernelSpecsFor(language: string): Promise<KernelspecMetadata[]> {
        return this.getAllKernelSpecs().then(kernelSpecs => {
            const lowerLang = language.toLowerCase();
            return kernelSpecs.filter(spec => spec.language.toLowerCase() === lowerLang);
        });
    }

    public getKernelSpecFor(language: string): Promise<KernelspecMetadata> {
        return this.getAllKernelSpecsFor(language).then(kernelSpecs => {
            if (kernelSpecs.length === 0) {
                throw new Error('Unable to find a kernel for ' + language);
            }
            if (pythonSettings.jupyter.defaultKernel.length > 0) {
                const defaultKernel = kernelSpecs.find(spec => spec.display_name === pythonSettings.jupyter.defaultKernel);
                if (defaultKernel) {
                    return defaultKernel;
                }
            }
            return kernelSpecs[0];
        });
    }

    public updateKernelSpecs(): Promise<{ [key: string]: Kernelspec }> {
        this._kernelSpecs = {};
        return this.getKernelSpecsFromJupyter().then(kernelSpecsFromJupyter => {
            this._kernelSpecs = kernelSpecsFromJupyter;
            if (Object.keys(this._kernelSpecs).length === 0) {
                throw new Error('No kernel specs found, Install or update IPython/Jupyter to a later version');
            }
            return this._kernelSpecs;
        });
    }

    public getKernelSpecsFromJupyter(): Promise<any> {
        return this.jupyterClient.getAllKernelSpecs();
    }
}