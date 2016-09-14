import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {Kernel} from './kernel';
import {WSKernel} from './ws-kernel';
import {ZMQKernel} from './zmq-kernel';
const _ = require('lodash');
const launchSpec = require('spawnteract').launchSpec;

export class KernelManager extends vscode.Disposable {
    private _runningKernels: Map<string, Kernel>;
    private _kernelSpecs: any;
    constructor() {
        super(() => { })
        this.getKernelSpecsFromJupyter = this.getKernelSpecsFromJupyter.bind(this);
        this.getAllKernelSpecs = this.getAllKernelSpecs.bind(this);
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

    public restartRunningKernelFor(language: string, onRestarted) {
        const kernel = this._runningKernels.get(language);
        if (kernel instanceof WSKernel) {
            kernel.restart().then(function () {
                return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
            });
            return;
        }
        if (kernel instanceof ZMQKernel && kernel.kernelProcess) {
            const kernelSpec = kernel.kernelSpec;
            this.destroyRunningKernelFor(language);
            this.startKernel(kernelSpec, language, function (kernel) {
                return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
            });
            return;
        }
        console.log('KernelManager: restartRunningKernelFor: ignored', kernel);
        vscode.window.showWarningMessage('Cannot restart this kernel');
        return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
    }

    public startKernelFor(language: string, onStarted) {
        try {
            const rootDirectory = path.dirname(vscode.window.activeTextEditor.document.fileName);
            const connectionFile = path.join(rootDirectory, 'hydrogen', 'connection.json');
            const connectionString = fs.readFileSync(connectionFile, 'utf8');
            const connection = JSON.parse(connectionString);
            this.startExistingKernel(language, connection, connectionFile, onStarted);
            return;
        } catch (_error) {
            const e = _error;
            if (e.code !== 'ENOENT') {
                console.log('KernelManager: Cannot start existing kernel:\n', e);
            }
        }
        return this.getKernelSpecFor(language, (function (_this) {
            return function (kernelSpec) {
                if (kernelSpec == null) {
                    const message = "No kernel for language `" + language + "` found";
                    const description = 'Check that the language for this file is set in Atom and that you have a Jupyter kernel installed for it.';
                    vscode.window.showErrorMessage(description);
                    return;
                }
                return _this.startKernel(kernelSpec, language, onStarted);
            };
        })(this));
    }

    public startExistingKernel(language: string, connection, connectionFile, onStarted) {
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
        return typeof onStarted === "function" ? onStarted(kernel) : void 0;
    }

    public startKernel(kernelSpec, language: string, onStarted) {
        console.log('KernelManager: startKernelFor:', language);
        const projectPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
        const spawnOptions = {
            cwd: projectPath
        };
        const that = this;
        return launchSpec(kernelSpec, spawnOptions).then((function (_this) {
            return function (arg) {
                const config = arg.config, connectionFile = arg.connectionFile, spawn = arg.spawn;
                const kernel = new ZMQKernel(kernelSpec, language, config, connectionFile, spawn);
                (that.setRunningKernelFor as Function).call(that, language, kernel);
                (that._executeStartupCode as Function).call(that, kernel);
                return typeof onStarted === "function" ? onStarted(kernel) : void 0;
            };
        })(this), error => {
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


    public getAllKernelSpecs(callback) {
        if (_.isEmpty(this._kernelSpecs)) {
            return this.updateKernelSpecs((function (_this) {
                return function () {
                    return callback(_.map(_this._kernelSpecs, 'spec'));
                };
            })(this));
        } else {
            return callback(_.map(this._kernelSpecs, 'spec'));
        }
    }

    public getAllKernelSpecsFor(language, callback) {
        if (language != null) {
            return this.getAllKernelSpecs((function (_this) {
                return function (kernelSpecs) {
                    const specs = kernelSpecs.filter(function (spec) {
                        return _this.kernelSpecProvidesLanguage(spec, language);
                    });
                    return callback(specs);
                };
            })(this));
        } else {
            return callback([]);
        }
    }

    public getKernelSpecFor(language, callback) {
        if (language == null) {
            return null;
        }
        return this.getAllKernelSpecsFor(language, (function (_this) {
            return function (kernelSpecs) {
                if (kernelSpecs.length <= 1) {
                    return callback(kernelSpecs[0]);
                } else {
                    if (_this.kernelPicker == null) {
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
                    return _this.kernelPicker.toggle();
                }
            };
        })(this));
    }

    public kernelSpecProvidesLanguage(kernelSpec, language) {
        var kernelLanguage, mappedLanguage;
        kernelLanguage = kernelSpec.language;
        mappedLanguage = {}[kernelLanguage];
        if (mappedLanguage) {
            return mappedLanguage === language;
        }
        return kernelLanguage.toLowerCase() === language;
    }

    public getKernelSpecsFromSettings() {
        var settings;
        settings = {};
        if (!settings.kernelspecs) {
            return {};
        }
        return _.pickBy(settings.kernelspecs, function (arg) {
            var spec;
            spec = arg.spec;
            return (spec != null ? spec.language : void 0) && spec.display_name && spec.argv;
        });
    }

    public mergeKernelSpecs(kernelSpecs) {
        return _.assign(this._kernelSpecs, kernelSpecs);
    }

    public updateKernelSpecs(callback) {
        this._kernelSpecs = this.getKernelSpecsFromSettings;
        return this.getKernelSpecsFromJupyter((function (_this) {
            return function (err, kernelSpecsFromJupyter) {
                if (!err) {
                    _this.mergeKernelSpecs(kernelSpecsFromJupyter);
                }
                if (_.isEmpty(_this._kernelSpecs)) {
                    const message = 'No kernel specs found';
                    const options = {
                        description: 'Use kernelSpec option in Hydrogen or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                        dismissable: true
                    };
                    vscode.window.showErrorMessage(message + ', ' + options.description);
                } else {
                    err = null;
                    const message = 'Hydrogen Kernels updated:';
                    const options = {
                        detail: (_.map(_this._kernelSpecs, 'spec.display_name')).join('\n')
                    };
                    // vscode.window.showErrorMessage(message + ', ' + options.detail);
                }
                return typeof callback === "function" ? callback(err, _this._kernelSpecs) : void 0;
            };
        })(this));
    }

    public getKernelSpecsFromJupyter(callback) {
        const jupyter = 'jupyter kernelspec list --json --log-level=CRITICAL';
        const ipython = 'ipython kernelspec list --json --log-level=CRITICAL';
        return this.getKernelSpecsFrom(jupyter, (function (_this) {
            return function (jupyterError, kernelSpecs) {
                if (!jupyterError) {
                    if (typeof callback === "function") {
                        callback(jupyterError, kernelSpecs);
                    }
                    return;
                }
                return _this.getKernelSpecsFrom(ipython, function (ipythonError, kernelSpecs) {
                    if (!ipythonError) {
                        return typeof callback === "function" ? callback(ipythonError, kernelSpecs) : void 0;
                    } else {
                        return typeof callback === "function" ? callback(jupyterError, kernelSpecs) : void 0;
                    }
                });
            };
        })(this));
    }

    public getKernelSpecsFrom(command, callback) {
        var options;
        options = {
            killSignal: 'SIGINT'
        };
        return child_process.exec(command, options, function (err, stdout, stderr) {
            var error, kernelSpecs;
            if (!err) {
                try {
                    kernelSpecs = JSON.parse(stdout).kernelspecs;
                } catch (_error) {
                    error = _error;
                    err = error;
                    console.log('Could not parse kernelspecs:', err);
                }
            }
            return typeof callback === "function" ? callback(err, kernelSpecs) : void 0;
        });
    }
}