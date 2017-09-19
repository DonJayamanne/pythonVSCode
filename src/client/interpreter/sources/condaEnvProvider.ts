"use strict";
import * as child_process from 'child_process';
import * as path from "path";
import { IInterpreterProvider, PythonInterpreter } from './contracts';
import { IS_WINDOWS } from "../../common/utils";

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
    public getInterpreters() {
        return this.suggestionsFromConda();
    }
    private suggestionsFromConda(): Promise<PythonInterpreter[]> {
        return new Promise((resolve, reject) => {
            // interrogate conda (if it's on the path) to find all environments
            child_process.execFile('conda', ['info', '--json'], (_, stdout) => {
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
            interpreter.displayName = `${displayName} (${path.basename(env)})`;  // e.g. someEnv, miniconda3
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