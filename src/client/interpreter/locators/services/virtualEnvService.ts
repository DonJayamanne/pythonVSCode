"use strict";
import * as _ from 'lodash';
import * as path from 'path';
import * as settings from './../../../common/configSettings';
import { VirtualEnvironmentManager } from '../../virtualEnvs';
import { IInterpreterLocatorService, PythonInterpreter } from '../../contracts';
import { IInterpreterVersionService } from '../../interpreterVersion';
import { IS_WINDOWS, fsReaddirAsync } from "../../../common/utils";
import { lookForInterpretersInDirectory } from '../helpers';
import { workspace } from 'vscode';
const untildify = require('untildify');

export class VirtualEnvProvider implements IInterpreterLocatorService {
    public constructor(private knownSearchPaths: string[],
        private virtualEnvMgr: VirtualEnvironmentManager,
        private versionProvider: IInterpreterVersionService) { }
    public getInterpreters() {
        return this.suggestionsFromKnownVenvs();
    }

    private suggestionsFromKnownVenvs() {
        return Promise.all(this.knownSearchPaths.map(dir => this.lookForInterpretersInVenvs(dir)))
            .then(listOfInterpreters => _.flatten(listOfInterpreters));
    }
    private lookForInterpretersInVenvs(pathToCheck: string) {
        return fsReaddirAsync(pathToCheck)
            .then(subDirs => Promise.all(this.getProspectiveDirectoriesForLookup(subDirs)))
            .then(dirs => dirs.filter(dir => dir.length > 0))
            .then(dirs => Promise.all(dirs.map(dir => lookForInterpretersInDirectory(dir))))
            .then(pathsWithInterpreters => _.flatten(pathsWithInterpreters))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getVirtualEnvDetails(interpreter))));
    }
    private getProspectiveDirectoriesForLookup(subDirs: string[]) {
        const dirToLookFor = IS_WINDOWS ? 'SCRIPTS' : 'BIN';
        return subDirs.map(subDir => fsReaddirAsync(subDir).then(dirs => {
            const scriptOrBinDirs = dirs.filter(dir => {
                const folderName = path.basename(dir);
                return folderName.toUpperCase() === dirToLookFor;
            });
            return scriptOrBinDirs.length === 1 ? scriptOrBinDirs[0] : '';
        }));
    }
    private async getVirtualEnvDetails(interpreter: string): Promise<PythonInterpreter> {
        const displayName = this.versionProvider.getVersion(interpreter, path.basename(interpreter));
        const virtualEnv = this.virtualEnvMgr.detect(interpreter);
        return Promise.all([displayName, virtualEnv])
            .then(([displayName, virtualEnv]) => {
                const virtualEnvSuffix = virtualEnv ? virtualEnv.name : this.getVirtualEnvironmentRootDirectory(interpreter);
                return {
                    displayName: `${displayName} (${virtualEnvSuffix})`.trim(),
                    path: interpreter
                };
            });
    }
    private getVirtualEnvironmentRootDirectory(interpreter: string) {
        return path.basename(path.dirname(path.dirname(interpreter)));
    }
}

export function getKnownSearchPathsForVirtualEnvs(): string[] {
    const paths: string[] = [];
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
    if (workspace.rootPath) {
        paths.push(workspace.rootPath);
    }
    return paths;
}