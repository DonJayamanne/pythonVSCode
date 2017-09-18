"use strict";
import * as child_process from 'child_process';
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import * as settings from "./../common/configSettings";
import * as utils from "../common/utils";
import * as untildify from 'untildify';
import { WindowsPythonInterpreters } from './winRegistryInterpreters';
import { PythonInterpreter, PythonPathSuggestion } from './contracts';
import { getArchitectureDislayName, RegistryImplementation } from '../common/registry';
import * as _ from 'lodash';
export * from './contracts';
import { Is_64Bit } from '../common/utils';

// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = utils.IS_WINDOWS ? ['python.exe'] : ['bin', 'python'];
const CHECK_PYTHON_INTERPRETER_REGEXP = utils.IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;
const AnacondaCompanyName = 'Continuum Analytics, Inc.';

export interface IPythonInterpreterProvider {
    getPythonInterpreters(): Promise<PythonPathSuggestion[]>;
}

export class PythonInterpreterProvider implements IPythonInterpreterProvider {
    public getPythonInterpreters(): Promise<PythonPathSuggestion[]> {
        return getSuggestedPythonInterpreters();
    }
}

function getSearchPaths(): Promise<string[]> {
    if (utils.IS_WINDOWS) {
        return Promise.resolve([]);
    } else {
        let paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'];
        paths.forEach(p => {
            paths.push(untildify('~' + p));
        });
        // Add support for paths such as /Users/xxx/anaconda/bin
        if (process.env['HOME']) {
            paths.push(path.join(process.env['HOME'], 'anaconda', 'bin'));
            paths.push(path.join(process.env['HOME'], 'python', 'bin'));
        }
        return Promise.resolve(paths);
    }
}
function getSearchVenvs(): Promise<string[]> {
    let paths = [];
    if (!utils.IS_WINDOWS) {
        const defaultPaths = ['/Envs', '/.virtualenvs', '/.pyenv', '/.pyenv/versions'];
        defaultPaths.forEach(p => {
            paths.push(untildify('~' + p));
        });
    }
    const venvPath = settings.PythonSettings.getInstance().venvPath;
    if (venvPath) {
        paths.push(untildify(venvPath));
    }
    return Promise.resolve(paths);
}

function lookForInterpretersInPath(pathToCheck: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(pathToCheck, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            const interpreters = subDirs
                .filter(subDir => CHECK_PYTHON_INTERPRETER_REGEXP.test(subDir))
                .map(subDir => path.join(pathToCheck, subDir));
            resolve(interpreters);
        });
    });
}
function lookForInterpretersInVenvs(pathToCheck: string): Promise<PythonPathSuggestion[]> {
    return new Promise<PythonPathSuggestion[]>(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(pathToCheck, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            const envsInterpreters = [];
            const promises = subDirs.map(subDir => {
                subDir = path.join(pathToCheck, subDir);
                const interpreterFolder = utils.IS_WINDOWS ? path.join(subDir, 'scripts') : path.join(subDir, 'bin');
                return lookForInterpretersInPath(interpreterFolder);
            });
            Promise.all<string[]>(promises).then(pathsWithInterpreters => {
                pathsWithInterpreters.forEach(interpreters => {
                    interpreters.map(interpreter => {
                        let venvName = path.basename(path.dirname(path.dirname(interpreter)));
                        envsInterpreters.push({
                            label: `${venvName} - ${path.basename(interpreter)}`,
                            path: interpreter,
                            type: ''
                        });
                    });
                });

                resolve(envsInterpreters);
            });
        });
    });
}
function suggestionsFromKnownPaths(): Promise<PythonPathSuggestion[]> {
    return getSearchPaths().then(paths => {
        const promises = paths.map(p => {
            return utils.fsExistsAsync(p).then(exists => {
                if (!exists) {
                    return Promise.resolve<string[]>([]);
                }

                return lookForInterpretersInPath(p);
            });
        });
        const currentPythonInterpreter = utils.execPythonFile("python", ["-c", "import sys;print(sys.executable)"], __dirname)
            .then(stdout => {
                if (stdout.length === 0) {
                    return [] as string[];
                }
                let lines = stdout.split(/\r?\n/g).filter(line => line.length > 0);
                return utils.fsExistsAsync(lines[0]).then(exists => exists ? [lines[0]] : []);
            }).catch(() => {
                return [] as string[];
            });

        return Promise.all<string[]>(promises.concat(currentPythonInterpreter)).then(listOfInterpreters => {
            const suggestions: PythonPathSuggestion[] = [];
            const interpreters = listOfInterpreters.reduce((previous, current) => previous.concat(current), []);
            interpreters.filter(interpreter => interpreter.length > 0).map(interpreter => {
                suggestions.push({
                    name: path.basename(interpreter), path: interpreter, type: ''
                });
            });
            return suggestions;
        });
    });
}
function suggestionsFromKnownVenvs(): Promise<PythonPathSuggestion[]> {
    return getSearchVenvs().then(paths => {
        const promises = paths.map(p => {
            return lookForInterpretersInVenvs(p);
        });

        return Promise.all<PythonPathSuggestion[]>(promises).then(listOfInterpreters => {
            let suggestions: PythonPathSuggestion[] = [];
            listOfInterpreters.forEach(s => {
                suggestions.push(...s);
            });
            return suggestions;
        });
    });
}
function suggestionsFromConda(): Promise<PythonPathSuggestion[]> {
    return new Promise((resolve, reject) => {
        // interrogate conda (if it's on the path) to find all environments
        child_process.execFile('conda', ['info', '--json'], (error, stdout, stderr) => {
            try {
                const info = JSON.parse(stdout);

                // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv
                const envs = <string[]>info['envs'];
                let environment = '';
                // "sys.version": "3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]",
                const version = <string>info['sys.version'] || '';
                const versionParts = version.split('|').map(item => item.trim());
                if (version && version.length > 0 && versionParts.length > 1 && versionParts[1].indexOf('conda') >= 0) {
                    environment = `${versionParts[1]} `;
                }

                // The root of the conda environment is itself a Python interpreter
                envs.push(info["default_prefix"]);

                const suggestions = envs.map(env => ({
                    name: `${environment}(${path.basename(env)})`,  // e.g. someEnv, miniconda3
                    path: path.join(env, ...CONDA_RELATIVE_PY_PATH),
                    type: AnacondaCompanyName,
                }));
                resolve(suggestions);
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

function fixPath(suggestion: PythonPathSuggestion): PythonPathSuggestion {
    // For some reason anaconda seems to use \\ in the registry path
    const path = utils.IS_WINDOWS ? suggestion.path.replace(/\\\\/g, "\\") : suggestion.path;
    return {
        ...suggestion,
        path
    };
}
function getSuggestionsFromWindowsRegistry() {
    if (!utils.IS_WINDOWS) {
        return Promise.resolve([]);
    }
    return new WindowsPythonInterpreters(new RegistryImplementation(), Is_64Bit).getInterpreters()
        .then(interpreters => interpreters.map(translateToPathSuggestion));
}
function translateToPathSuggestion(item: PythonInterpreter): PythonPathSuggestion {
    let displayName = item.displayName;
    if (!displayName) {
        const arch = getArchitectureDislayName(item.architecture);
        const version = item.version || '';
        displayName = ['Python', version, arch].filter(item => item.length > 0).join(' ');
    }
    return {
        path: item.path,
        name: displayName,
        type: item.companyDisplayName
    };
}

function getSuggestedPythonInterpreters(): Promise<PythonPathSuggestion[]> {
    // For now we only interrogate conda for suggestions.
    const suggestionPromises: Promise<PythonPathSuggestion[]>[] = [];
    if (utils.IS_WINDOWS) {
        suggestionPromises.push(getSuggestionsFromWindowsRegistry());
    }
    else {
        suggestionPromises.push(suggestionsFromKnownPaths());
    }
    suggestionPromises.push(...[
        suggestionsFromKnownVenvs(),
        lookForInterpretersInVenvs(vscode.workspace.rootPath),
        suggestionsFromConda()
    ]);

    return Promise.all<PythonPathSuggestion[]>(suggestionPromises)
        .then(suggestions => {
            return _.flatten(suggestions)
                .map(fixPath)
                // Remove duplicates
                .reduce<PythonPathSuggestion[]>((prev, current) => {
                    if (!prev.find(item => item.path.toUpperCase() === current.path.toUpperCase())) {
                        prev.push(current);
                    }
                    return prev;
                }, []);
        });
}