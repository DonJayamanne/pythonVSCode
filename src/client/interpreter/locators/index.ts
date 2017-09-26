"use strict";
import * as _ from 'lodash';
import { fixInterpreterPath, fixInterpreterDisplayName } from './helpers';
import { IInterpreterLocatorService, PythonInterpreter } from '../contracts';
import { InterpreterVersionService } from '../interpreterVersion';
import { IS_WINDOWS, Is_64Bit, arePathsSame, areBasePathsSame } from '../../common/utils';
import { RegistryImplementation } from '../../common/registry';
import { CondaEnvService } from './services/condaEnvService';
import { VirtualEnvService, getKnownSearchPathsForVirtualEnvs } from './services/virtualEnvService';
import { KnownPathsService, getKnownSearchPathsForInterpreters } from './services/KnownPathsService';
import { CurrentPathService } from './services/currentPathService';
import { WindowsRegistryService } from './services/windowsRegistryService';
import { VirtualEnvironmentManager } from '../virtualEnvs';
import { CondaEnvFileService, getEnvironmentsFile as getCondaEnvFile } from './services/condaEnvFileService';

export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private interpreters: PythonInterpreter[] = [];
    private locators: IInterpreterLocatorService[] = [];
    constructor(private virtualEnvMgr: VirtualEnvironmentManager) {
        const versionService = new InterpreterVersionService();
        // The order of the services is important
        if (IS_WINDOWS) {
            const windowsRegistryProvider = new WindowsRegistryService(new RegistryImplementation(), Is_64Bit);
            this.locators.push(windowsRegistryProvider);
            this.locators.push(new CondaEnvService(windowsRegistryProvider));
        }
        else {
            this.locators.push(new CondaEnvService());
        }
        // Supplements the above list of conda environments
        this.locators.push(new CondaEnvFileService(getCondaEnvFile(), versionService));
        this.locators.push(new VirtualEnvService(getKnownSearchPathsForVirtualEnvs(), this.virtualEnvMgr, versionService));

        if (!IS_WINDOWS) {
            // This must be last, it is possible we have paths returned here that are already returned 
            // in one of the above lists
            this.locators.push(new KnownPathsService(getKnownSearchPathsForInterpreters(), versionService));
        }
        // This must be last, it is possible we have paths returned here that are already returned 
        // in one of the above lists
        this.locators.push(new CurrentPathService(this.virtualEnvMgr, versionService));
    }
    public getInterpreters() {
        if (this.interpreters.length > 0) {
            return Promise.resolve(this.interpreters);
        }
        const promises = this.locators.map(provider => provider.getInterpreters());
        return Promise.all(promises)
            .then(interpreters => _.flatten(interpreters))
            .then(items => items.map(fixInterpreterDisplayName))
            .then(items => items.map(fixInterpreterPath))
            .then(items => items.reduce<PythonInterpreter[]>((prev, current) => {
                if (prev.findIndex(item => arePathsSame(item.path, current.path)) === -1 &&
                    prev.findIndex(item => areBasePathsSame(item.path, current.path)) === -1) {
                    prev.push(current);
                }
                return prev;
            }, []))
            .then(interpreters => this.interpreters = interpreters);
    }
}