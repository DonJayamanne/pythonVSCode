/// <reference path="../../../typings/spawnteract.d.ts" />
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {Kernel} from './kernel';
import {WSKernel} from './ws-kernel';
import {ZMQKernel} from './zmq-kernel';
import {launchSpec} from 'spawnteract';
import {KernelspecMetadata, Kernelspec} from './contracts';
import {Commands} from '../common/constants';

export class KernelManagerImpl extends vscode.Disposable {
    private _runningKernels: Map<string, Kernel>;
    private _kernelSpecs: { [key: string]: Kernelspec };
    private disposables: vscode.Disposable[];
    constructor(private outputChannel: vscode.OutputChannel) {
        super(() => { });
        this.disposables = [];
        this._runningKernels = new Map<string, Kernel>();
        this._kernelSpecs = this.getKernelSpecsFromSettings();
        this.registerCommands();
    }

    private registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Get_All_KernelSpecs_For_Language, this.getAllKernelSpecsFor.bind(this)));
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
        try {
            const rootDirectory = path.dirname(vscode.window.activeTextEditor.document.fileName);
            const connectionFile = path.join(rootDirectory, 'jupyter', 'connection.json');
            const connectionString = fs.readFileSync(connectionFile, 'utf8');
            const connection = JSON.parse(connectionString);
            return this.startExistingKernel(language, connection, connectionFile);
        } catch (_error) {
            const e = _error;
            if (e.code !== 'ENOENT') {
                this.outputChannel.appendLine('KernelManager: Cannot start existing kernel:\n' + e);
            }
        }
        return this.getKernelSpecFor(language).then(kernelSpec => {
            if (kernelSpec == null) {
                const message = `No kernel for language '${language}' found`;
                const description = 'Check that the language for this file is set in VS Code and that you have a Jupyter kernel installed for it.';
                vscode.window.showErrorMessage(description);
                return;
            }
            return this.startKernel(kernelSpec, language);
        }).catch(() => {
            const message = `No kernel for language '${language}' found`;
            const description = 'Check that the language for this file is set in VS Code and that you have a Jupyter kernel installed for it.';
            vscode.window.showErrorMessage(description);
            return null;
        });
    }

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel> {
        return new Promise<Kernel>((resolve, reject) => {
            // console.log('KernelManager: startExistingKernel: Assuming', language);
            const kernelSpec = {
                display_name: 'Existing Kernel',
                language: language,
                argv: [],
                env: {}
            };
            const kernel = new ZMQKernel(kernelSpec, language, connection, connectionFile);
            this.setRunningKernelFor(language, kernel);
            this._executeStartupCode(kernel);
            resolve(kernel);
        });
    }

    public startKernel(kernelSpec: KernelspecMetadata, language: string): Promise<Kernel> {
        // console.log('KernelManager: startKernelFor:', language);
        const projectPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
        const spawnOptions = {
            cwd: projectPath
        };
        return launchSpec(kernelSpec, spawnOptions).then(result => {
            const kernel = new ZMQKernel(kernelSpec, language, result.config, result.connectionFile, result.spawn);
            this.setRunningKernelFor(language, kernel);
            this._executeStartupCode(kernel);
            return Promise.resolve(kernel);
        }, error => {
            return Promise.reject(error);
        });
    }

    public _executeStartupCode(kernel: Kernel) {
        const displayName = kernel.kernelSpec.display_name;
        // startupCode = Config.getJson('startupCode')[displayName];
        let startupCode = {}[displayName];
        if (startupCode != null) {
            // console.log('KernelManager: Executing startup code:', startupCode);
            startupCode = startupCode + ' \n';
            return kernel.execute(startupCode, () => { });
        }
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
        if (language != null) {
            return this.getAllKernelSpecs().then(kernelSpecs => {
                return kernelSpecs.filter(spec => {
                    return this.kernelSpecProvidesLanguage(spec, language);
                });
            });
        } else {
            return Promise.resolve([]);
        }
    }

    public getKernelSpecFor(language: string): Promise<KernelspecMetadata> {
        if (language == null) {
            return Promise.resolve(null);
        }
        return this.getAllKernelSpecsFor(language).then(kernelSpecs => {
            if (kernelSpecs.length >= 1) {
                return kernelSpecs[0];
            } else {
                // if (this.kernelPicker == null) {
                throw new Error('Oops');
                // _this.kernelPicker = new KernelPicker(function (onUpdated) {
                //     return onUpdated(kernelSpecs);
                // });
                // _this.kernelPicker.onConfirmed = function (arg) {
                //     var kernelSpec;
                //     kernelSpec = arg.kernelSpec;
                //     return callback(kernelSpec);
                // };
            }
            // return this.kernelPicker.toggle();
        });
    }

    public kernelSpecProvidesLanguage(kernelSpec, language: string) {
        const kernelLanguage = kernelSpec.language;
        const mappedLanguage = {}[kernelLanguage];
        if (mappedLanguage) {
            return mappedLanguage === language;
        }
        return kernelLanguage.toLowerCase() === language;
    }

    public getKernelSpecsFromSettings(): { [key: string]: Kernelspec } {
        const settings: any = {};
        return settings;
    }

    public mergeKernelSpecs(kernelSpecs) {
        for (const key in kernelSpecs) {
            this._kernelSpecs[key] = kernelSpecs[key];
        }
        // return _.assign(this._kernelSpecs, kernelSpecs);
    }

    public updateKernelSpecs(): Promise<any> {
        this._kernelSpecs = this.getKernelSpecsFromSettings();
        return this.getKernelSpecsFromJupyter().then(kernelSpecsFromJupyter => {
            this.mergeKernelSpecs(kernelSpecsFromJupyter);
            if (Object.keys(this._kernelSpecs).length === 0) {
                const message = 'No kernel specs found';
                const options = {
                    description: 'Use kernelSpec option in VS Code or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                    dismissable: true
                };
                vscode.window.showErrorMessage(message + ', ' + options.description);
            } else {
                const message = 'VS Code Kernels updated:';
                const details = Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key].spec.display_name).join('\n');
                this.outputChannel.appendLine(message + ', ' + details);
            }
            return this._kernelSpecs;
        }).catch(() => {
            if (Object.keys(this._kernelSpecs).length === 0) {
                const message = 'No kernel specs found';
                const options = {
                    description: 'Use kernelSpec option in VS Code or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                    dismissable: true
                };
                vscode.window.showErrorMessage(message + ', ' + options.description);
            } else {
                const message = 'VS Code Kernels updated:';
                const details = Object.keys(this._kernelSpecs).map(key => this._kernelSpecs[key].spec.display_name).join('\n');
                this.outputChannel.appendLine(message + ', ' + details);
            }
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