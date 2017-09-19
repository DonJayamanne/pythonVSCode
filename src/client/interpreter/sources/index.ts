"use strict";
import * as _ from 'lodash';
import { fixInterpreterPath, fixInterpreterDisplayName } from './helpers';
import { IInterpreterProvider } from './contracts';
import { IS_WINDOWS, Is_64Bit, arePathsSame } from '../../common/utils';
import { RegistryImplementation } from '../../common/registry';
import { CondaEnvProvider } from './condaEnvProvider';
import { PythonInterpreter } from '../index';
import { VirtualEnvProvider, getKnownSearchPathsForVirtualEnvs } from './virtualEnvProvider';
import { KnownPathsProvider, getKnownSearchPathsForInterpreters } from './KnownPathsProvider';
import { WindowsRegistryProvider } from './windowsRegistryProvider';
export * from './contracts';

export class PythonInterpreterProvider implements IInterpreterProvider {
    private providers: IInterpreterProvider[] = [];
    constructor() {
        if (IS_WINDOWS) {
            this.providers.push(new WindowsRegistryProvider(new RegistryImplementation(), Is_64Bit));
        }
        this.providers.push(...[
            new CondaEnvProvider(),
            new VirtualEnvProvider(getKnownSearchPathsForVirtualEnvs())
        ]);
        if (!IS_WINDOWS) {
            this.providers.push(new KnownPathsProvider(getKnownSearchPathsForInterpreters()));
        }
    }
    public getInterpreters() {
        const promises = this.providers.map(provider => provider.getInterpreters());
        return Promise.all(promises)
            .then(interpreters => _.flatten(interpreters))
            .then(items => items.map(fixInterpreterDisplayName))
            .then(items => items.map(fixInterpreterPath))
            .then(items => items.reduce<PythonInterpreter[]>((prev, current) => {
                if (prev.findIndex(item => arePathsSame(item.path, current.path)) === -1) {
                    prev.push(current);
                }
                return prev;
            }, []));
    }
}