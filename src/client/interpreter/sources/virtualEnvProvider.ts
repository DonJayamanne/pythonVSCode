"use strict";
import * as path from "path";
import * as vscode from 'vscode';
import { IInterpreterProvider } from './contracts';
import { IS_WINDOWS, fsReaddirAsync } from "../../common/utils";
import { PythonPathSuggestion } from '../index';
import * as untildify from 'untildify';
import { lookForInterpretersInDirectory } from './helpers';
import * as settings from "./../../common/configSettings";
import * as _ from 'lodash';

export class VirtualEnvProvider implements IInterpreterProvider {
    public constructor(private knownSearchPaths: string[]) { }
    public getInterpreters() {
        return this.suggestionsFromKnownVenvs();
    }

    private suggestionsFromKnownVenvs(): Promise<PythonPathSuggestion[]> {
        const promises = this.knownSearchPaths.map(dir => this.lookForInterpretersInVenvs(dir));

        return Promise.all(promises)
            .then(listOfInterpreters => _.flatten(listOfInterpreters));
    }
    private lookForInterpretersInVenvs(pathToCheck: string): Promise<PythonPathSuggestion[]> {
        return fsReaddirAsync(pathToCheck)
            .then(subDirs => {
                const promises = subDirs.map(subDir => {
                    const interpreterFolder = IS_WINDOWS ? path.join(subDir, 'scripts') : path.join(subDir, 'bin');
                    return lookForInterpretersInDirectory(interpreterFolder);
                });
                return Promise.all(promises);
            })
            .then(pathsWithInterpreters => _.flatten(pathsWithInterpreters))
            .then(interpreters => interpreters.map(interpreter => this.getVirtualEnvDetails(interpreter)));
    }
    private getVirtualEnvDetails(interpreter: string): PythonPathSuggestion {
        let venvName = this.getVirtualEnvironmentRootDirectory(interpreter);
        return {
            name: `${venvName} - ${path.basename(interpreter)}`,
            path: interpreter,
            type: ''
        };
    }
    private getVirtualEnvironmentRootDirectory(interpreter: string) {
        return path.basename(path.dirname(path.dirname(interpreter)));
    }
}

export function getKnownSearchPathsForVirtualEnvs(): string[] {
    let paths = [];
    if (!IS_WINDOWS) {
        const defaultPaths = ['/Envs', '/.virtualenvs', '/.pyenv', '/.pyenv/versions'];
        defaultPaths.forEach(p => {
            paths.push(untildify('~' + p));
        });
    }
    const venvPath = settings.PythonSettings.getInstance().venvPath;
    if (venvPath) {
        paths.push(untildify(venvPath));
    }
    if (vscode.workspace && vscode.workspace.rootPath) {
        paths.push(vscode.workspace.rootPath);
    }
    return paths;
}