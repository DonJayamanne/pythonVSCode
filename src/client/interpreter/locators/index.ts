'use strict';
import * as _ from 'lodash';
import { Uri } from 'vscode';
import { RegistryImplementation } from '../../common/registry';
import { areBasePathsSame, arePathsSame, Is_64Bit, IS_WINDOWS } from '../../common/utils';
import { IInterpreterLocatorService, PythonInterpreter } from '../contracts';
import { InterpreterVersionService } from '../interpreterVersion';
import { VirtualEnvironmentManager } from '../virtualEnvs';
import { fixInterpreterDisplayName, fixInterpreterPath } from './helpers';
import { CondaEnvFileService, getEnvironmentsFile as getCondaEnvFile } from './services/condaEnvFileService';
import { CondaEnvService } from './services/condaEnvService';
import { CurrentPathService } from './services/currentPathService';
import { getKnownSearchPathsForInterpreters, KnownPathsService } from './services/KnownPathsService';
import { getKnownSearchPathsForVirtualEnvs, VirtualEnvService } from './services/virtualEnvService';
import { WindowsRegistryService } from './services/windowsRegistryService';

export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private interpreters: PythonInterpreter[] = [];
    private locators: IInterpreterLocatorService[] = [];
    constructor(private virtualEnvMgr: VirtualEnvironmentManager) {
        const versionService = new InterpreterVersionService();
        // The order of the services is important.
        if (IS_WINDOWS) {
            const windowsRegistryProvider = new WindowsRegistryService(new RegistryImplementation(), Is_64Bit);
            this.locators.push(windowsRegistryProvider);
            this.locators.push(new CondaEnvService(windowsRegistryProvider));
        }
        else {
            this.locators.push(new CondaEnvService());
        }
        // Supplements the above list of conda environments.
        this.locators.push(new CondaEnvFileService(getCondaEnvFile(), versionService));
        this.locators.push(new VirtualEnvService(getKnownSearchPathsForVirtualEnvs(), this.virtualEnvMgr, versionService));

        if (!IS_WINDOWS) {
            // This must be last, it is possible we have paths returned here that are already returned
            // in one of the above lists.
            this.locators.push(new KnownPathsService(getKnownSearchPathsForInterpreters(), versionService));
        }
        // This must be last, it is possible we have paths returned here that are already returned
        // in one of the above lists.
        this.locators.push(new CurrentPathService(this.virtualEnvMgr, versionService));
    }
    public async getInterpreters(resource?: Uri) {
        if (this.interpreters.length > 0) {
            return this.interpreters;
        }
        const promises = this.locators.map(provider => provider.getInterpreters(resource));
        return Promise.all(promises)
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(interpreters => _.flatten(interpreters))
            .then(items => items.map(fixInterpreterDisplayName))
            .then(items => items.map(fixInterpreterPath))
            .then(items => items.reduce<PythonInterpreter[]>((accumulator, current) => {
                if (accumulator.findIndex(item => arePathsSame(item.path, current.path)) === -1 &&
                    accumulator.findIndex(item => areBasePathsSame(item.path, current.path)) === -1) {
                    accumulator.push(current);
                }
                return accumulator;
            }, []))
            .then(interpreters => this.interpreters = interpreters);
    }
}
