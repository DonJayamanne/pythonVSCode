"use strict";
import * as _ from 'lodash';
import { fixInterpreterPath, fixInterpreterDisplayName } from './helpers';
import { IInterpreterProvider } from './contracts';
import { IS_WINDOWS, Is_64Bit, arePathsSame, areBasePathsSame } from '../../common/utils';
import { RegistryImplementation } from '../../common/registry';
import { CondaEnvProvider } from './providers/condaEnvProvider';
import { PythonInterpreter } from '../index';
import { VirtualEnvProvider, getKnownSearchPathsForVirtualEnvs } from './providers/virtualEnvProvider';
import { KnownPathsProvider, getKnownSearchPathsForInterpreters } from './providers/KnownPathsProvider';
import { CurrentPathProvider } from './providers/CurrentPathProvider';
import { WindowsRegistryProvider } from './providers/windowsRegistryProvider';
import { VirtualEnvironmentManager } from '../virtualEnvs';
export * from './contracts';

export class PythonInterpreterProvider implements IInterpreterProvider {
    private interpreters: PythonInterpreter[] = [];
    private providers: IInterpreterProvider[] = [];
    constructor(private virtualEnvMgr: VirtualEnvironmentManager) {
        // The order of the providers is important
        if (IS_WINDOWS) {
            this.providers.push(new WindowsRegistryProvider(new RegistryImplementation(), Is_64Bit));
        }
        this.providers.push(...[
            new CondaEnvProvider(),
            new VirtualEnvProvider(getKnownSearchPathsForVirtualEnvs(), this.virtualEnvMgr)
        ]);
        if (!IS_WINDOWS) {
            // This must be last, it is possible we have paths returned here that are already returned 
            // in one of the above lists
            this.providers.push(new KnownPathsProvider(getKnownSearchPathsForInterpreters()));
        }
        // This must be last, it is possible we have paths returned here that are already returned 
        // in one of the above lists
        this.providers.push(new CurrentPathProvider(this.virtualEnvMgr));
    }
    public getInterpreters() {
        if (this.interpreters.length > 0) {
            return Promise.resolve(this.interpreters);
        }
        const promises = this.providers.map(provider => provider.getInterpreters());
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