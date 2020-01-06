// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, inject } from 'inversify';
import { IConfigurationService, IDisposable, IDisposableRegistry, Resource } from '../../../common/types';
import { IProcessServiceFactory } from '../../../common/process/types';
import { cache } from '../../../common/utils/decorators';
import { traceError } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { lookForInterpretersInDirectory } from '../helpers';
const flatten = require('lodash/flatten') as typeof import('lodash/flatten');

const cacheEnvDuration = 10 * 60 * 1000;
const cacheIsInstalledDuration = 60 * 1000;

@injectable()
export class PoetryServce implements IDisposable {
    private readonly disposables: IDisposable[] = [];
    constructor(
        @inject(IConfigurationService) private readonly configurationService: IConfigurationService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IProcessServiceFactory) private readonly processFactory: IProcessServiceFactory
    ) {
        disposableRegistry.push(this);
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    @cache(cacheIsInstalledDuration)
    public async isInstalled(resource: Resource): Promise<boolean> {
        const processService = await this.processFactory.create(resource);
        return processService
            .exec(this.configurationService.getSettings(resource).poetryPath, ['--version'])
            .then(output => (output.stderr ? false : true))
            .catch(() => false);
    }

    // @cache(cacheEnvDuration)
    // public async getCurrentEnvironment(resource: Resource): Promise<string | undefined> {
    //     const processService = await this.processFactory.create(resource);
    //     const dir = await processService
    //         .exec(this.configurationService.getSettings(resource).poetryPath, ['env', 'info', '--path'])
    //         .then(out => {
    //             if (out.stderr) {
    //                 traceError('Failed to get current environment from Poetry', out.stderr);
    //                 return '';
    //             }
    //             return out.stdout.endsWith('%') ? out.stdout.substring(0, out.stdout.length - 1).trim() : out.stdout.trim();
    //         })
    //         .catch(ex => {
    //             traceError('Failed to get current environment from Poetry', ex);
    //             return '';
    //         });

    //     const interpreters = await this.getInterpretersInDirectory(dir);
    //     return interpreters.length === 0 ? undefined : interpreters[0];
    // }
    @cache(cacheEnvDuration)
    public async getEnvironments(resource: Resource): Promise<string[]> {
        const processService = await this.processFactory.create(resource);
        const output = await processService
            .exec(this.configurationService.getSettings(resource).poetryPath, ['env', 'list', '--full-path'])
            .then(out => {
                if (out.stderr) {
                    traceError('Failed to get a list of environments from Poetry', out.stderr);
                    return '';
                }
                return out.stdout;
            })
            .catch(ex => {
                traceError('Failed to get a list of environments from Poetry', ex);
                return '';
            });

        const interpreters = output
            .splitLines({ trim: true, removeEmptyEntries: true })
            .map(line => {
                if (line.endsWith('(Activated)')) {
                    return line.substring(0, line.length - '(Activated)'.length).trim();
                }
                return line;
            })
            .map(dir => this.getInterpretersInDirectory(dir));

        return Promise.all(interpreters).then(listOfInterpreters => flatten(listOfInterpreters));
    }

    /**
     * Return the interpreters in the given directory.
     */
    private async getInterpretersInDirectory(dir: string) {
        const exists = this.fs.directoryExists(dir);
        if (exists) {
            return lookForInterpretersInDirectory(dir, this.fs);
        }
        return [];
    }
}
