import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../../../common/configSettings';
import { IProcessFactory } from '../../../common/process/processFactory';
import { IInterpreterLocatorService, IInterpreterVersionService, InterpreterType } from '../../contracts';
import { IVirtualEnvironmentManager } from '../../virtualEnvs/types';

@injectable()
export class CurrentPathService implements IInterpreterLocatorService {
    public constructor( @inject(IVirtualEnvironmentManager) private virtualEnvMgr: IVirtualEnvironmentManager,
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IProcessFactory) private processFactory: IProcessFactory) { }
    public async getInterpreters(resource?: Uri) {
        return this.suggestionsFromKnownPaths();
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    private async suggestionsFromKnownPaths(resource?: Uri) {
        const currentPythonInterpreter = this.getInterpreter(PythonSettings.getInstance(resource).pythonPath, '', resource).then(interpreter => [interpreter]);
        const python = this.getInterpreter('python', '', resource).then(interpreter => [interpreter]);
        const python2 = this.getInterpreter('python2', '', resource).then(interpreter => [interpreter]);
        const python3 = this.getInterpreter('python3', '', resource).then(interpreter => [interpreter]);
        return Promise.all<string[]>([currentPythonInterpreter, python, python2, python3])
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            // tslint:disable-next-line:promise-function-async
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter, resource))));
    }
    private async getInterpreterDetails(interpreter: string, resource?: Uri) {
        return Promise.all([
            this.versionProvider.getVersion(interpreter, path.basename(interpreter), resource),
            this.virtualEnvMgr.detect(interpreter)
        ])
            .then(([displayName, virtualEnv]) => {
                displayName += virtualEnv ? ` (${virtualEnv.name})` : '';
                return {
                    displayName,
                    path: interpreter,
                    type: InterpreterType.Unknown
                };
            });
    }
    private async getInterpreter(pythonPath: string, defaultValue: string, resource?: Uri) {
        const processService = this.processFactory.create(resource);
        return processService.exec(pythonPath, ['-c', 'import sys;print(sys.executable)'], {})
            .then(result => result.stdout.trim())
            .then(value => value.length === 0 ? defaultValue : value)
            .catch(() => defaultValue);    // Ignore exceptions in getting the executable.
    }
}
