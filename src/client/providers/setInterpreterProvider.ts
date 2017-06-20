"use strict";
import * as child_process from 'child_process';
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import * as settings from "./../common/configSettings";
import * as utils from "../common/utils";
import { createDeferred } from '../common/helpers';
import * as untildify from 'untildify';

// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = utils.IS_WINDOWS ? ['python'] : ['bin', 'python'];
const CHECK_PYTHON_INTERPRETER_REGEXP = utils.IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;

interface PythonPathSuggestion {
    label: string; // myenvname
    path: string;  // /full/path/to/bin/python
    type: string;   // conda
}

interface PythonPathQuickPickItem extends vscode.QuickPickItem {
    path: string;
}

function getSearchPaths(): Promise<string[]> {
    if (utils.IS_WINDOWS) {
        const localAppData = process.env['LOCALAPPDATA'];
        const appData = process.env['APPDATA'];
        const lookupParentDirectories = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'],
            localAppData, appData,
        process.env['SystemDrive']];
        lookupParentDirectories.push(path.join(process.env['SystemDrive'], 'Python'));
        if (appData) {
            lookupParentDirectories.push(path.join(localAppData, 'Programs'));
        }
        if (localAppData) {
            lookupParentDirectories.push(path.join(appData, 'Programs'));
        }
        const dirPromises = lookupParentDirectories.map(rootDir => {
            if (!rootDir) {
                return Promise.resolve([]);
            }
            const def = createDeferred<string[]>();
            fs.readdir(rootDir, (error, files) => {
                if (error) {
                    return def.resolve([]);
                }
                const possiblePythonDirs = [];
                files.forEach(name => {
                    const fullPath = path.join(rootDir, name);
                    try {
                        if ((name.toUpperCase().indexOf('PYTHON') >= 0 || name.toUpperCase().indexOf('ANACONDA') >= 0) &&
                            fs.statSync(fullPath).isDirectory()) {
                            possiblePythonDirs.push(fullPath);
                        }
                    }
                    catch (ex) {
                    }
                });
                def.resolve(possiblePythonDirs);
            });
            return def.promise;
        });

        return Promise.all(dirPromises).then(validPathsCollection => {
            return validPathsCollection.reduce((previousValue, currentValue) => previousValue.concat(currentValue), []);
        });
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
    if (settings.PythonSettings.getInstance().venvPath) {
        const venvPath = settings.PythonSettings.getInstance().venvPath;
        paths.push(untildify(venvPath));
    }
    return Promise.resolve(paths);
}

export function activateSetInterpreterProvider(): vscode.Disposable {
    return vscode.commands.registerCommand("python.setInterpreter", setInterpreter);
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
            return utils.validatePath(p).then(validatedPath => {
                if (validatedPath.length === 0) {
                    return Promise.resolve<string[]>([]);
                }

                return lookForInterpretersInPath(validatedPath);
            });
        });
        const currentPythonInterpreter = utils.execPythonFile("python", ["-c", "import sys;print(sys.executable)"], __dirname)
            .then(stdout => {
                if (stdout.length === 0) {
                    return [] as string[];
                }
                let lines = stdout.split(/\r?\n/g).filter(line => line.length > 0);
                return utils.validatePath(lines[0]).then(p=> [p]);
            }).catch(() => {
                return [] as string[];
            });

        return Promise.all<string[]>(promises.concat(currentPythonInterpreter)).then(listOfInterpreters => {
            const suggestions: PythonPathSuggestion[] = [];
            const interpreters = listOfInterpreters.reduce((previous, current) => previous.concat(current), []);
            interpreters.filter(interpreter => interpreter.length > 0).map(interpreter => {
                suggestions.push({
                    label: path.basename(interpreter), path: interpreter, type: ''
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

        return Promise.all<PythonPathSuggestion[]>(promises).then((listOfInterpreters) => {
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

                // The root of the conda environment is itself a Python interpreter
                envs.push(info["default_prefix"]);

                const suggestions = envs.map(env => ({
                    label: path.basename(env),  // e.g. someEnv, miniconda3
                    path: path.join(env, ...CONDA_RELATIVE_PY_PATH),
                    type: 'conda',
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

function suggestionToQuickPickItem(suggestion: PythonPathSuggestion): PythonPathQuickPickItem {
    let detail = suggestion.path;
    if (suggestion.path.startsWith(vscode.workspace.rootPath)) {
        detail = `.${path.sep}` + path.relative(vscode.workspace.rootPath, suggestion.path);
    }
    detail = utils.IS_WINDOWS ? detail.replace(/\\/g, "/") : detail;
    return {
        label: suggestion.label,
        description: suggestion.type,
        detail: detail,
        path: utils.IS_WINDOWS ? suggestion.path.replace(/\\/g, "/") : suggestion.path
    };
}

function suggestPythonPaths(): Promise<PythonPathQuickPickItem[]> {
    // For now we only interrogate conda for suggestions.
    const condaSuggestions = suggestionsFromConda();
    const knownPathSuggestions = suggestionsFromKnownPaths();
    const knownVenvSuggestions = suggestionsFromKnownVenvs();
    const workspaceVirtualEnvSuggestions = lookForInterpretersInVenvs(vscode.workspace.rootPath);

    const suggestionPromises = [condaSuggestions, knownPathSuggestions, knownVenvSuggestions, workspaceVirtualEnvSuggestions];

    return Promise.all<PythonPathSuggestion[]>(suggestionPromises).then(suggestions => {
        const quickPicks: PythonPathQuickPickItem[] = [];
        suggestions.forEach(list => {
            quickPicks.push(...list.map(suggestionToQuickPickItem));
        });

        return quickPicks;
    });
}

function setPythonPath(pythonPath: string, created: boolean = false) {
    if (pythonPath.startsWith(vscode.workspace.rootPath)) {
        pythonPath = path.join('${workspaceRoot}', path.relative(vscode.workspace.rootPath, pythonPath));
    }
    const pythonConfig = vscode.workspace.getConfiguration('python');
    pythonConfig.update('pythonPath', pythonPath).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${reason.message}`);
        console.error(reason);
    });
}

function presentQuickPickOfSuggestedPythonPaths() {
    let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    if (currentPythonPath.startsWith(vscode.workspace.rootPath)) {
        currentPythonPath = `.${path.sep}` + path.relative(vscode.workspace.rootPath, currentPythonPath);
    }
    const quickPickOptions: vscode.QuickPickOptions = {
        matchOnDetail: true,
        matchOnDescription: false,
        placeHolder: `current: ${currentPythonPath}`
    };

    suggestPythonPaths().then(suggestions => {
        suggestions = suggestions.sort((a, b) => a.path > b.path ? 1 : -1);
        vscode.window.showQuickPick(suggestions, quickPickOptions).then(
            value => {
                if (value !== undefined) {
                    setPythonPath(value.path);
                }
            });
    });
}

function setInterpreter() {
    if (typeof vscode.workspace.rootPath !== 'string') {
        return vscode.window.showErrorMessage('Please open a workspace to select the Python Interpreter');
    }
    presentQuickPickOfSuggestedPythonPaths();
}