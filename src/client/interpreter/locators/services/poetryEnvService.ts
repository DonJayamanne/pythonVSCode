// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable, inject } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { CacheableLocatorService } from './cacheableLocatorService';
import { POETRY_ENV_SERVICE, PythonInterpreter, IInterpreterHelper, InterpreterType } from '../../contracts';
import { PoetryServce } from './poetryService';
import { Resource } from '../../../common/types';
import { traceError, traceDecorators } from '../../../common/logger';
import { noop } from '../../../common/utils/misc';

/**
 * Interpreter locator for Poetry.
 *
 * @export
 * @class PoetryEnvService
 * @extends {CacheableLocatorService}
 */
@injectable()
export class PoetryEnvService extends CacheableLocatorService {
    constructor(
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(PoetryServce) private readonly poetryService: PoetryServce,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper
    ) {
        super(POETRY_ENV_SERVICE, serviceContainer, true);
    }
    public dispose(): void {
        noop();
    }
    protected async getInterpretersImplementation(resource: Resource): Promise<PythonInterpreter[]> {
        return this.getPoetryInterpreters(resource).catch(ex => {
            traceError('Failed to get Poetry Interpreters', ex);
            return [];
        });
    }

    @traceDecorators.error('Failed to get Poetry Interepters')
    protected async getPoetryInterpreters(resource: Resource): Promise<PythonInterpreter[]> {
        if (!(await this.poetryService.isInstalled(resource))) {
            return [];
        }

        const interpreterPaths = await this.poetryService.getEnvironments(resource);
        const items = await Promise.all(
            interpreterPaths.map(item => {
                return this.helper
                    .getInterpreterInformation(item)
                    .then(info => {
                        if (!info) {
                            return;
                        }
                        return {
                            ...info,
                            type: InterpreterType.Poetry
                        };
                    })
                    .catch(ex => {
                        // Handle each error, we don't want everything to fail.
                        traceError(`Failed to get interpreter information for Poetry Interpreter, ${item}`, ex);
                        return;
                    });
            })
        );

        return items.filter(item => !!item).map(item => item! as PythonInterpreter);
    }
}
