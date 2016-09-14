import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {Kernel} from './kernel';
import {WSKernel} from './ws-kernel';
import {ZMQKernel} from './zmq-kernel';
import * as _ from 'lodash';
import {launchSpec} from 'spawnteract';
import {KernelspecMetadata, Kernelspec} from './contracts';

export class KernelManager extends vscode.Disposable {
    private _runningKernels: Map<string, Kernel>;
    private _kernelSpecs: { [key: string]: Kernelspec };
    constructor() {
        super(() => { })
        //this.getKernelSpecsFromJupyter = this.getKernelSpecsFromJupyter.bind(this);
        //this.getAllKernelSpecs = this.getAllKernelSpecs.bind(this);
        this._runningKernels = new Map<string, Kernel>();
        this._kernelSpecs = this.getKernelSpecsFromSettings();
    }
    public dispose() {
        this.destroy();
    }
    public destroy() {
        this._runningKernels.forEach(kernel => {
            kernel.destroy();
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
            kernel.destroy();
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
            return this.startKernel(kernelSpec, language).then(k => {
                let x = "";
                return k;
            });
        }
        console.log('KernelManager: restartRunningKernelFor: ignored', kernel);
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
                console.log('KernelManager: Cannot start existing kernel:\n', e);
            }
        }
        return this.getKernelSpecFor(language).then(kernelSpec => {
            if (kernelSpec == null) {
                const message = "No kernel for language `" + language + "` found";
                const description = 'Check that the language for this file is set in Atom and that you have a Jupyter kernel installed for it.';
                vscode.window.showErrorMessage(description);
                return;
            }
            return this.startKernel(kernelSpec, language);
        }).catch(() => {
            const message = "No kernel for language `" + language + "` found";
            const description = 'Check that the language for this file is set in Atom and that you have a Jupyter kernel installed for it.';
            vscode.window.showErrorMessage(description);
            return null;
        });
    }

    public startExistingKernel(language: string, connection, connectionFile): Promise<Kernel> {
        return new Promise<Kernel>((resolve, reject) => {
            console.log('KernelManager: startExistingKernel: Assuming', language);
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
        console.log('KernelManager: startKernelFor:', language);
        const projectPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
        const spawnOptions = {
            cwd: projectPath
        };
        // const that = this;
        // return launchSpec(kernelSpec, spawnOptions).then((function (_this) {
        //     return function (arg) {
        //         const config = arg.config, connectionFile = arg.connectionFile, spawn = arg.spawn;
        //         const kernel = new ZMQKernel(kernelSpec, language, config, connectionFile, spawn);
        //         (that.setRunningKernelFor as Function).call(that, language, kernel);
        //         (that._executeStartupCode as Function).call(that, kernel);
        //         return typeof onStarted === "function" ? onStarted(kernel) : void 0;
        //     };
        // })(this), error => {
        //     return Promise.reject(error);
        // });
        return launchSpec(kernelSpec, spawnOptions).then(result => {
            const kernel = new ZMQKernel(kernelSpec, language, result.config, result.connectionFile, result.spawn);
            this.setRunningKernelFor(language, kernel);
            this._executeStartupCode(kernel);
            return Promise.resolve(kernel);
        }, error => {
            return Promise.reject(error);
        });
    }

    public _executeStartupCode(kernel) {
        const displayName = kernel.kernelSpec.display_name;
        // startupCode = Config.getJson('startupCode')[displayName];
        let startupCode = {}[displayName];
        if (startupCode != null) {
            console.log('KernelManager: Executing startup code:', startupCode);
            startupCode = startupCode + ' \n';
            return kernel.execute(startupCode);
        }
    }

    public getAllRunningKernels() {
        return _.clone(this._runningKernels);
    }

    public getRunningKernelFor(language) {
        return this._runningKernels[language];
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
            if (kernelSpecs.length <= 1) {
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
        var settings;
        settings = {};
        return settings;
    }

    public mergeKernelSpecs(kernelSpecs) {
        return _.assign(this._kernelSpecs, kernelSpecs);
    }

    public updateKernelSpecs(): Promise<any> {
        this._kernelSpecs = this.getKernelSpecsFromSettings();
        return this.getKernelSpecsFromJupyter().then(kernelSpecsFromJupyter => {
            this.mergeKernelSpecs(kernelSpecsFromJupyter);
            if (_.isEmpty(this._kernelSpecs)) {
                const message = 'No kernel specs found';
                const options = {
                    description: 'Use kernelSpec option in VS Code or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                    dismissable: true
                };
                vscode.window.showErrorMessage(message + ', ' + options.description);
            } else {
                const message = 'VS Code Kernels updated:';
                const options = {
                    detail: (_.map(this._kernelSpecs, 'spec.display_name')).join('\n')
                };
                // vscode.window.showErrorMessage(message + ', ' + options.detail);
            }
            return this._kernelSpecs;
        }).catch(() => {
            if (_.isEmpty(this._kernelSpecs)) {
                const message = 'No kernel specs found';
                const options = {
                    description: 'Use kernelSpec option in VS Code or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                    dismissable: true
                };
                vscode.window.showErrorMessage(message + ', ' + options.description);
            } else {
                const message = 'VS Code Kernels updated:';
                const options = {
                    detail: (_.map(this._kernelSpecs, 'spec.display_name')).join('\n')
                };
                // vscode.window.showErrorMessage(message + ', ' + options.detail);
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
        var options;
        options = {
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
                    console.log('Could not parse kernelspecs:', err);
                    return reject(err);
                }
            });
        });
    }
}