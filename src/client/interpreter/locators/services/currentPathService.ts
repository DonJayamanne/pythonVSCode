'use strict';
import * as child_process from 'child_process';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { IInterpreterLocatorService } from '../../contracts';
import { getFirstNonEmptyLineFromMultilineString } from '../../helpers';
import { IInterpreterVersionService } from '../../interpreterVersion';
import { VirtualEnvironmentManager } from '../../virtualEnvs';

export class CurrentPathService implements IInterpreterLocatorService {
    public constructor(private virtualEnvMgr: VirtualEnvironmentManager,
        private versionProvider: IInterpreterVersionService) { }
    public async getInterpreters(resource?: Uri) {
        return this.suggestionsFromKnownPaths();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const currentPythonInterpreter = this.getInterpreter(PythonSettings.getInstance(resource).pythonPath, '').then(interpreter => [interpreter]);
        const python = this.getInterpreter('python', '').then(interpreter => [interpreter]);
        const python2 = this.getInterpreter('python2', '').then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3', '').then(interpreter => [interpreter]);
        return Promise.all<string[]>([currentPythonInterpreter, python, python2, python3])
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            // tslint:disable-next-line:promise-function-async
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private async getInterpreterDetails(interpreter: string) {
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter)),
            this.virtualEnvMgr.detect(interpreter)
        ])
            .then(([displayName, virtualEnv]) => {
                displayName += virtualEnv ? ` (${virtualEnv.name})` : '';
                return {
                    displayName,
                    path: interpreter
                };
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string) {
        return new Promise<string>(resolve => {
            // tslint:disable-next-line:variable-name
            child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_err, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        })
            .then(value => value.length === 0 ? defaultValue : value);
    }
}
