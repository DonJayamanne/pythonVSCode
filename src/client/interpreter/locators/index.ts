"use strict";
import * as _ from 'lodash';
import { fixInterpreterPath, fixInterpreterDisplayName } from './helpers';
import { IInterpreterLocatorService, PythonInterpreter } from '../contracts';
import { InterpreterVersionService } from '../interpreterVersion';
import { IS_WINDOWS, Is_64Bit, arePathsSame, areBasePathsSame } from '../../common/utils';
import { RegistryImplementation } from '../../common/registry';
import { CondaEnvProvider } from './services/condaEnvService';
import { VirtualEnvProvider, getKnownSearchPathsForVirtualEnvs } from './services/virtualEnvService';
import { KnownPathsProvider, getKnownSearchPathsForInterpreters } from './services/KnownPathsService';
import { CurrentPathProvider } from './services/CurrentPathService';
import { WindowsRegistryProvider } from './services/windowsRegistryService';
import { VirtualEnvironmentManager } from '../virtualEnvs';
import { CondaEnvFileProvider, getEnvironmentsFile as getCondaEnvFile } from './services/condaEnvFileService';

export class PythonInterpreterLocatorService implements IInterpreterLocatorService {
    private interpreters: PythonInterpreter[] = [];
    private locators: IInterpreterLocatorService[] = [];
    constructor(private virtualEnvMgr: VirtualEnvironmentManager) {
        const versionService = new InterpreterVersionService();
        // The order of the services is important
        if (IS_WINDOWS) {
            const windowsRegistryProvider = new WindowsRegistryProvider(new RegistryImplementation(), Is_64Bit);
            this.locators.push(windowsRegistryProvider);
            this.locators.push(new CondaEnvProvider(windowsRegistryProvider));
            this.locators.push(new CondaEnvFileProvider(getCondaEnvFile(), versionService));
        }
        else {
            this.locators.push(new CondaEnvProvider());
        }
        this.locators.push(new VirtualEnvProvider(getKnownSearchPathsForVirtualEnvs(), this.virtualEnvMgr, versionService));

        if (!IS_WINDOWS) {
            // This must be last, it is possible we have paths returned here that are already returned 
            // in one of the above lists
            this.locators.push(new KnownPathsProvider(getKnownSearchPathsForInterpreters(), versionService));
        }
        // This must be last, it is possible we have paths returned here that are already returned 
        // in one of the above lists
        this.locators.push(new CurrentPathProvider(this.virtualEnvMgr, versionService));
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