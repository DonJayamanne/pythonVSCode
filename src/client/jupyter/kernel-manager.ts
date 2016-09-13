var _, launchSpec;
// let bind = function (fn, me) { return function () { return fn.apply(me, arguments); }; };
// let KernelPicker,
_ = require('lodash');
import * as child_process from 'child_process';
launchSpec = require('spawnteract').launchSpec;
import * as fs from 'fs';
import * as path from 'path';
// const Config = require('./config');
import * as vscode from 'vscode';
import {WSKernel} from './ws-kernel';
import {ZMQKernel} from './zmq-kernel';

// KernelPicker = require('./kernel-picker');

export class KernelManager {
    private _runningKernels: any;
    private _kernelSpecs: any;
    constructor() {
        // this.getKernelSpecsFromJupyter = bind(this.getKernelSpecsFromJupyter, this);
        this.getKernelSpecsFromJupyter = this.getKernelSpecsFromJupyter.bind(this);
        // this.getAllKernelSpecs = bind(this.getAllKernelSpecs, this);
        this.getAllKernelSpecs = this.getAllKernelSpecs.bind(this);
        this._runningKernels = {};
        this._kernelSpecs = this.getKernelSpecsFromSettings();
    }

    public destroy() {
        _.forEach(this._runningKernels, function (kernel) {
            return kernel.destroy();
        });
        return this._runningKernels = {};
    }

    public setRunningKernelFor(grammar, kernel) {
        var language;
        language = this.getLanguageFor(grammar);
        kernel.kernelSpec.language = language;
        return this._runningKernels[language] = kernel;
    }

    public destroyRunningKernelFor(grammar) {
        var kernel, language;
        language = this.getLanguageFor(grammar);
        kernel = this._runningKernels[language];
        delete this._runningKernels[language];
        return kernel != null ? kernel.destroy() : void 0;
    }

    public restartRunningKernelFor(grammar, onRestarted) {
        var kernel, kernelSpec, language;
        language = this.getLanguageFor(grammar);
        kernel = this._runningKernels[language];
        if (kernel instanceof WSKernel) {
            kernel.restart().then(function () {
                return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
            });
            return;
        }
        if (kernel instanceof ZMQKernel && kernel.kernelProcess) {
            kernelSpec = kernel.kernelSpec;
            this.destroyRunningKernelFor(grammar);
            this.startKernel(kernelSpec, grammar, function (kernel) {
                return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
            });
            return;
        }
        console.log('KernelManager: restartRunningKernelFor: ignored', kernel);
        // atom.notifications.addWarning('Cannot restart this kernel');
        vscode.window.showWarningMessage('Cannot restart this kernel');
        return typeof onRestarted === "function" ? onRestarted(kernel) : void 0;
    }

    public startKernelFor(grammar, onStarted) {
        var connection, connectionFile, connectionString, e, language, rootDirectory;
        try {
            // rootDirectory = atom.project.rootDirectories[0].path || path.dirname(atom.workspace.getActiveTextEditor().getPath());
            rootDirectory = path.dirname(vscode.window.activeTextEditor.document.fileName);
            connectionFile = path.join(rootDirectory, 'hydrogen', 'connection.json');
            connectionString = fs.readFileSync(connectionFile, 'utf8');
            connection = JSON.parse(connectionString);
            this.startExistingKernel(grammar, connection, connectionFile, onStarted);
            return;
        } catch (_error) {
            e = _error;
            if (e.code !== 'ENOENT') {
                console.log('KernelManager: Cannot start existing kernel:\n', e);
            }
        }
        language = this.getLanguageFor(grammar);
        return this.getKernelSpecFor(language, (function (_this) {
            return function (kernelSpec) {
                var description, message;
                if (kernelSpec == null) {
                    message = "No kernel for language `" + language + "` found";
                    description = 'Check that the language for this file is set in Atom and that you have a Jupyter kernel installed for it.';
                    // atom.notifications.addError(message, {
                    //     description: description
                    // });
                    vscode.window.showErrorMessage(description);
                    return;
                }
                return _this.startKernel(kernelSpec, grammar, onStarted);
            };
        })(this));
    }

    public startExistingKernel(grammar, connection, connectionFile, onStarted) {
        var kernel, kernelSpec, language;
        language = this.getLanguageFor(grammar);
        console.log('KernelManager: startExistingKernel: Assuming', language);
        kernelSpec = {
            display_name: 'Existing Kernel',
            language: language,
            argv: [],
            env: {}
        };
        kernel = new ZMQKernel(kernelSpec, grammar, connection, connectionFile);
        this.setRunningKernelFor(grammar, kernel);
        this._executeStartupCode(kernel);
        return typeof onStarted === "function" ? onStarted(kernel) : void 0;
    }

    public startKernel(kernelSpec, grammar, onStarted) {
        var language, projectPath, spawnOptions;
        language = this.getLanguageFor(grammar);
        console.log('KernelManager: startKernelFor:', language);
        // projectPath = path.dirname(atom.workspace.getActiveTextEditor().getPath());
        projectPath = path.dirname(vscode.window.activeTextEditor.document.fileName);
        spawnOptions = {
            cwd: projectPath
        };
        const that = this;
        return launchSpec(kernelSpec, spawnOptions).then((function (_this) {
            return function (arg) {
                var config, connectionFile, kernel, spawn;
                config = arg.config, connectionFile = arg.connectionFile, spawn = arg.spawn;
                kernel = new ZMQKernel(kernelSpec, grammar, config, connectionFile, spawn);
                (that.setRunningKernelFor as Function).call(that, grammar, kernel);
                (that._executeStartupCode as Function).call(that, kernel);
                return typeof onStarted === "function" ? onStarted(kernel) : void 0;
            };
        })(this), error=>{
            const x = error;
            return Promise.reject(error);
        });
    }

    public _executeStartupCode(kernel) {
        var displayName, startupCode;
        displayName = kernel.kernelSpec.display_name;
        // startupCode = Config.getJson('startupCode')[displayName];
        startupCode = {}[displayName];
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

    public getLanguageFor(grammar) {
        //return grammar != null ? grammar.name.toLowerCase() : void 0;
        return 'python';
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
                    var specs;
                    specs = kernelSpecs.filter(function (spec) {
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
        // mappedLanguage = Config.getJson('languageMappings')[kernelLanguage];
        mappedLanguage = {}[kernelLanguage];
        if (mappedLanguage) {
            return mappedLanguage === language;
        }
        return kernelLanguage.toLowerCase() === language;
    }

    public getKernelSpecsFromSettings() {
        var settings;
        // settings = Config.getJson('kernelspec');
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
                var message, options;
                if (!err) {
                    _this.mergeKernelSpecs(kernelSpecsFromJupyter);
                }
                if (_.isEmpty(_this._kernelSpecs)) {
                    message = 'No kernel specs found';
                    options = {
                        description: 'Use kernelSpec option in Hydrogen or update IPython/Jupyter to a version that supports: `jupyter kernelspec list --json` or `ipython kernelspec list --json`',
                        dismissable: true
                    };
                    // atom.notifications.addError(message, options);
                    vscode.window.showErrorMessage(message + ', ' + options.description);
                } else {
                    err = null;
                    message = 'Hydrogen Kernels updated:';
                    options = {
                        detail: (_.map(_this._kernelSpecs, 'spec.display_name')).join('\n')
                    };
                    // atom.notifications.addInfo(message, options);
                    vscode.window.showErrorMessage(message + ', ' + options.detail);
                }
                return typeof callback === "function" ? callback(err, _this._kernelSpecs) : void 0;
            };
        })(this));
    }

    public getKernelSpecsFromJupyter(callback) {
        var ipython, jupyter;
        jupyter = 'jupyter kernelspec list --json --log-level=CRITICAL';
        ipython = 'ipython kernelspec list --json --log-level=CRITICAL';
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

// ---
// generated by coffee-script 1.9.2