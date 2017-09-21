"use strict";
import * as child_process from 'child_process';
import * as path from 'path';
import { IInterpreterProvider, PythonInterpreter } from '../contracts';
import { IS_WINDOWS, fsExistsAsync } from "../../../common/utils";
import { VersionUtils } from "../../../common/versionUtils";

// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = IS_WINDOWS ? ['python.exe'] : ['bin', 'python'];
const AnacondaCompanyName = 'Continuum Analytics, Inc.';
const AnacondaDisplayName = 'Anaconda';

type CondaInfo = {
    envs: string[];
    "sys.version": string;
    default_prefix: string;
}
export class CondaEnvProvider implements IInterpreterProvider {
    constructor(private registryLookupForConda?: IInterpreterProvider) {
    }
    public getInterpreters() {
        return this.getSuggestionsFromConda();
    }

    private getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        return this.getCondaFile()
            .then(condaFile => {
                return new Promise<PythonInterpreter[]>((resolve, reject) => {
                    // interrogate conda (if it's on the path) to find all environments
                    child_process.execFile(condaFile, ['info', '--json'], (_, stdout) => {
                        if (stdout.length === 0) {
                            return resolve([]);
                        }

                        try {
                            const info = JSON.parse(stdout);
                            resolve(this.parseCondaInfo(info));
                        } catch (e) {
                            // Failed because either:
                            //   1. conda is not installed
                            //   2. `conda info --json` has changed signature
                            //   3. output of `conda info --json` has changed in structure
                            // In all cases, we can't offer conda pythonPath suggestions.
                            return resolve([]);
                        }
                    });
                });
            });
    }
    public getCondaFile() {
        if (this.registryLookupForConda) {
            return this.registryLookupForConda.getInterpreters()
                .then(interpreters => interpreters.filter(this.isCondaEnvironment))
                .then(condaInterpreters => this.getLatestVersion(condaInterpreters))
                .then(condaInterpreter => {
                    return condaInterpreter ? path.join(path.dirname(condaInterpreter.path), 'Scripts', 'conda.exe') : 'conda';
                })
                .then(condaPath => {
                    return fsExistsAsync(condaPath).then(exists => exists ? condaPath : 'conda');
                });
        }
        return Promise.resolve('conda');
    }
    public isCondaEnvironment(interpreter: PythonInterpreter) {
        return (interpreter.displayName || '').toUpperCase().indexOf('ANACONDA') >= 0 ||
            (interpreter.companyDisplayName || '').toUpperCase().indexOf('CONTINUUM') >= 0;
    }
    public getLatestVersion(interpreters: PythonInterpreter[]) {
        const sortedInterpreters = interpreters.filter(interpreter => interpreter.version && interpreter.version.length > 0);
        sortedInterpreters.sort((a, b) => VersionUtils.compareVersion(a.version!, b.version!));
        if (sortedInterpreters.length > 0) {
            return sortedInterpreters[sortedInterpreters.length - 1];
        }
    }
    public async parseCondaInfo(info: CondaInfo) {
        // "sys.version": "3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]",
        const displayName = this.getDisplayNameFromVersionInfo(info['sys.version']);

        // The root of the conda environment is itself a Python interpreter
        // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv
        const envs = info.envs || [];
        if (info.default_prefix && info.default_prefix.length > 0) {
            envs.push(info.default_prefix);
        }

        return envs.map(env => {
            const interpreter: PythonInterpreter = { path: path.join(env, ...CONDA_RELATIVE_PY_PATH) };
            if (env === info.default_prefix) {
                interpreter.displayName = displayName;
            }
            else {
                // This is an environment, hence suffix with env name
                interpreter.displayName = `${displayName} (${path.basename(env)})`;  // e.g. someEnv, miniconda3                
            }
            interpreter.companyDisplayName = AnacondaCompanyName;
            return interpreter;
        });
    }
    private getDisplayNameFromVersionInfo(versionInfo: string = '') {
        if (!versionInfo) {
            return AnacondaDisplayName;
        }

        const versionParts = versionInfo.split('|').map(item => item.trim());
        if (versionParts.length > 1 && versionParts[1].indexOf('conda') >= 0) {
            return versionParts[1];
        }
        return AnacondaDisplayName;
    }
}
