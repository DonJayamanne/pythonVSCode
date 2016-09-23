/// <reference path="../../../typings/spawnteract.d.ts" />
import * as child_process from 'child_process';
import * as os from 'os';
import * as vscode from 'vscode';
import {Kernel} from './kernel';
import {WSKernel} from './ws-kernel';
import {ZMQKernel} from './zmq-kernel';
import {launchSpec} from 'spawnteract';
import {KernelspecMetadata, Kernelspec} from './contracts';
import {Commands} from '../common/constants';
import {EventEmitter} from 'events';
import {PythonSettings} from '../common/configSettings';
const pythonSettings = PythonSettings.getInstance();

export class KernelManagerImpl extends EventEmitter {
    private _runningKernels: Map<string, Kernel>;
    private _kernelSpecs: { [key: string]: Kernelspec };
    private disposables: vscode.Disposable[];
    constructor(private outputChannel: vscode.OutputChannel) {
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
        if (kernel != null) {
            kernel.dispose();
        }
    }

    public restartRunningKernelFor(language: string): Promise<Kernel> {
        const kernel = this._runningKernels.get(language);
        if (kernel instanceof WSKernel) {
            return new Promise<Kernel>((resolve, reject) => {
                kernel.restart().then(() => {
                    resolve(kernel);
                }, reject);
            });
        }
        if (kernel instanceof ZMQKernel && kernel.kernelProcess) {
            const kernelSpec = kernel.kernelSpec;
            this.destroyRunningKernelFor(language);
            return this.startKernel(kernelSpec, language);
        }
        // this.outputChannel.appendLine('KernelManager: restartRunningKernelFor: ignored for ' + kernel.kernelSpec.display_name);
        vscode.window.showWarningMessage('Cannot restart this kernel');
        return Promise.resolve(kernel);
    }

    public startKernelFor(language: string): Promise<Kernel> {
        return this.getKernelSpecFor(language).then(kernelSpec => {
            if (!kernelSpec) {
                const message = `No kernel for language '${language}' found. Ensure you have a Jupyter or IPython kernel installed for it.`;
                vscode.window.showErrorMessage(message);
                this.outputChannel.appendLine(message);
                return;
            }
            return this.startKernel(kernelSpec, language);
        }).catch(reason => {
            const message = `No kernel for language '${language}' found. Ensure you have a Jupyter or IPython kernel installed for it.`;
            vscode.window.showErrorMessage(message);
            this.outputChannel.appendLine(message);
            this.outputChannel.appendLine('Error in finding the kernel: ' + reason);
            return null;
        });
    }

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel> {
        return new Promise<Kernel>((resolve, reject) => {
            const kernelSpec = {
                display_name: 'Existing Kernel',
                language: language,
                argv: [],
                env: {}
            };
            const kernel = new ZMQKernel(kernelSpec, language, connection, connectionFile);
            this.setRunningKernelFor(language, kernel);
            return this._executeStartupCode(kernel).then(() => {
                return kernel;
            });
        });
    }

    public startKernel(kernelSpec: KernelspecMetadata, language: string): Promise<Kernel> {
        this.destroyRunningKernelFor(language);
        // This doesn't always work
        // const projectPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
        const spawnOptions = {
            cwd: vscode.workspace.rootPath
        };
        return launchSpec(kernelSpec, spawnOptions).then(result => {
            const kernel = new ZMQKernel(kernelSpec, language, result.config, result.connectionFile, result.spawn);
            this.setRunningKernelFor(language, kernel);
            return this._executeStartupCode(kernel).then(() => kernel);
        }, error => {
            return Promise.reject(error);
        });
    }

    public _executeStartupCode(kernel: Kernel): Promise<any> {
        if (pythonSettings.jupyter.startupCode.length === 0) {
            return Promise.resolve();
        }
        const suffix = ' ' + os.EOL;
        let startupCode = pythonSettings.jupyter.startupCode.join(suffix) + suffix;
        return new Promise<any>(resolve => {
            kernel.execute(startupCode, () => resolve());
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
            if (kernelSpecs.length > 0) {
                if (pythonSettings.jupyter.defaultKernel.length > 0) {
                    const defaultKernel = kernelSpecs.find(spec => spec.display_name === pythonSettings.jupyter.defaultKernel);
                    if (defaultKernel) {
                        return defaultKernel;
                    }
                }
                return kernelSpecs[0];
            } else {
                throw new Error('Unable to find a kernel for ' + language);
            }
        });
    }

    public updateKernelSpecs(): Promise<{ [key: string]: Kernelspec }> {
        this._kernelSpecs = {};
        return this.getKernelSpecsFromJupyter().then(kernelSpecsFromJupyter => {
            this._kernelSpecs = kernelSpecsFromJupyter;
            if (Object.keys(this._kernelSpecs).length === 0) {
                const message = 'No kernel specs found, Update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`';
                this.outputChannel.appendLine(message);
                vscode.window.showErrorMessage(message);
            } else {
                const message = 'VS Code Kernels updated:';
                const details = Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key].spec.display_name).join(', ');
                this.outputChannel.appendLine(message + ', ' + details);
            }
            return this._kernelSpecs;
        }).catch(reason => {
            const message = 'No kernel specs found, Update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`';
            this.outputChannel.appendLine(message);
            this.outputChannel.appendLine('Error in finding kernels: ' + reason);
            vscode.window.showErrorMessage(message);
            return this._kernelSpecs;
        });
    }

    public getKernelSpecsFromJupyter(): Promise<any> {
        const jupyter = 'jupyter kernelspec list --json --log-level=CRITICAL';
        const ipython = 'ipython kernelspec list --json --log-level=CRITICAL';
        return this.getKernelSpecsFrom(jupyter).catch(jupyterError => {
            return this.getKernelSpecsFrom(ipython);
        });
    }

    public getKernelSpecsFrom(command: string): Promise<any> {
        const options = {
            killSignal: 'SIGINT'
        };
        return new Promise<any>((resolve, reject) => {
            return child_process.exec(command, options, (err, stdout, stderr) => {
                if (err) {
                    return reject(err);
                }
                try {
                    const kernelSpecs = JSON.parse(stdout).kernelspecs;
                    resolve(kernelSpecs);
                } catch (err) {
                    return reject(err);
                }
            });
        });
    }
}