"use strict";
import * as fs from 'fs-extra';
import * as path from 'path';
import { IInterpreterVersionService } from '../../interpreterVersion';
import { IInterpreterLocatorService, PythonInterpreter } from '../../contracts';
import { AnacondaDisplayName, AnacondaCompanyName, CONDA_RELATIVE_PY_PATH } from './conda';

/**
 * The command 'conda info --envs' doesn't seem to return all environments
 * Environments created using the command 'conda create --p python=x.x' are not returned by the above command
 * However all these environments seem to be listed in the environments.txt file (confirmed on windows and linux)
 * @export
 * @class CondaEnvFileProvider
 * @implements {IInterpreterLocatorService}
 */
export class CondaEnvFileService implements IInterpreterLocatorService {
    constructor(private condaEnvironmentFile: string,
        private versionService: IInterpreterVersionService) {
    }
    public getInterpreters() {
        return this.getSuggestionsFromConda();
    }

    private getSuggestionsFromConda(): Promise<PythonInterpreter[]> {
        return fs.pathExists(this.condaEnvironmentFile)
            .then(exists => exists ? this.getEnvironmentsFromFile(this.condaEnvironmentFile) : Promise.resolve([]));
    }
    private getEnvironmentsFromFile(envFile: string) {
        return fs.readFile(envFile)
            .then(buffer => buffer.toString().split(/\r?\n/g))
            .then(lines => {
                return lines.map(line => path.join(line, ...CONDA_RELATIVE_PY_PATH));
            })
            .then(interpreterPaths => {
                return interpreterPaths.map(item => fs.pathExists(item).then(exists => exists ? item : ''));
            })
            .then(promises => Promise.all(promises))
            .then(interpreterPaths => {
                return interpreterPaths.filter(item => item.trim().length > 0);
            })
            .then(interpreterPaths => interpreterPaths.map(item => this.getInterpreterDetails(item)))
            .then(promises => Promise.all(promises));
    }
    private getInterpreterDetails(interpreter: string) {
        return this.versionService.getVersion(interpreter, path.basename(interpreter))
            .then(version => {
                // Strip company name from version
                const startOfCompanyName = version.indexOf(`:: ${AnacondaCompanyName}`);
                version = startOfCompanyName > 0 ? version.substring(0, startOfCompanyName).trim() : version;
                const envName = this.getEnvironmentRootDirectory(interpreter);
                const info: PythonInterpreter = {
                    displayName: `${AnacondaDisplayName} ${version} (${envName})`,
                    path: interpreter,
                    companyDisplayName: AnacondaCompanyName,
                    version: version
                };
                return info;
            });
    }
    private getEnvironmentRootDirectory(interpreter: string) {
        const envDir = interpreter.substring(0, interpreter.length - path.join(...CONDA_RELATIVE_PY_PATH).length);
        return path.basename(envDir);
    }
}

export function getEnvironmentsFile() {
    const homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    return homeDir ? path.join(homeDir, '.conda', 'environments.txt') : '';
}
