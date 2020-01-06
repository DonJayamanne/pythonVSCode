// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { PoetryServce } from '../../../client/interpreter/locators/services/poetryService';
import { Uri } from 'vscode';
import { assert } from 'chai';
import { when, mock, instance, verify } from 'ts-mockito';
import { Resource } from '../../../client/common/types';
import { PoetryEnvService } from '../../../client/interpreter/locators/services/poetryEnvService';
import { IInterpreterHelper, InterpreterType } from '../../../client/interpreter/contracts';
import { ServiceContainer } from '../../../client/ioc/container';
import { InterpreterHelper } from '../../../client/interpreter/helpers';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Interpreters - PoetryService', () => {
    class PoetryEnvServiceTest extends PoetryEnvService {
        public getInterpretersImplementation(resource: Resource) {
            return super.getInterpretersImplementation(resource);
        }
    }
    let poetryService: PoetryServce;
    let poetryEnvService: PoetryEnvServiceTest;
    let svc: IServiceContainer;
    let helper: IInterpreterHelper;
    setup(() => {
        poetryService = mock(PoetryServce);
        svc = mock(ServiceContainer);
        helper = mock(InterpreterHelper);

        poetryEnvService = new PoetryEnvServiceTest(instance(svc), instance(poetryService), instance(helper));
    });

    [undefined, Uri.file('wow.py')].forEach(resource => {
        suite(resource ? 'Without a resource' : 'With a resource', () => {
            test('Returns an empty list of interpreters if poetry is not installed', async () => {
                when(poetryService.isInstalled(resource)).thenResolve(false);

                const interpreters = await poetryEnvService.getInterpretersImplementation(resource);

                verify(poetryService.isInstalled(resource)).once();
                verify(poetryService.getEnvironments(resource)).never();
                assert.deepEqual(interpreters, []);
            });
            test('Returns an empty list of interpreters if no environments are returned by PoetryService', async () => {
                when(poetryService.isInstalled(resource)).thenResolve(true);
                when(poetryService.getEnvironments(resource)).thenResolve([]);

                const interpreters = await poetryEnvService.getInterpretersImplementation(resource);

                verify(poetryService.isInstalled(resource)).once();
                verify(poetryService.getEnvironments(resource)).once();
                assert.deepEqual(interpreters, []);
            });
            test('Returns an list of interpreters', async () => {
                const envs = [path.join('one', 'wow.exe'), path.join('two', 'python')];
                when(poetryService.isInstalled(resource)).thenResolve(true);
                when(poetryService.getEnvironments(resource)).thenResolve(envs);
                when(helper.getInterpreterInformation(envs[0])).thenResolve({ path: envs[0] });
                when(helper.getInterpreterInformation(envs[1])).thenResolve({ path: envs[1] });

                const interpreters = await poetryEnvService.getInterpretersImplementation(resource);

                verify(poetryService.isInstalled(resource)).once();
                verify(poetryService.getEnvironments(resource)).once();
                assert.deepEqual(
                    interpreters,
                    envs.map(item => ({ path: item, type: InterpreterType.Poetry }))
                );
            });
        });
    });
});
