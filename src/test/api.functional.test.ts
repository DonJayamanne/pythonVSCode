// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { assert, expect } from 'chai';
import * as path from 'path';
import { anyString, instance, mock, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { buildApi } from '../client/api';
import { ConfigurationService } from '../client/common/configuration/service';
import { EXTENSION_ROOT_DIR } from '../client/common/constants';
import { ExperimentsManager } from '../client/common/experiments';
import { IConfigurationService, IExperimentsManager } from '../client/common/types';
import { ServiceContainer } from '../client/ioc/container';
import { ServiceManager } from '../client/ioc/serviceManager';
import { IServiceContainer, IServiceManager } from '../client/ioc/types';

suite('Extension API', () => {
    const expectedLauncherPath = `${EXTENSION_ROOT_DIR.fileToCommandArgument()}/pythonFiles/ptvsd_launcher.py`;
    const ptvsdPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'lib', 'python', 'debugpy', 'no_wheels', 'debugpy');
    const ptvsdHost = 'somehost';
    const ptvsdPort = 12345;

    let serviceContainer: IServiceContainer;
    let serviceManager: IServiceManager;
    let experimentsManager: IExperimentsManager;
    let configurationService: IConfigurationService;

    setup(() => {
        serviceContainer = mock(ServiceContainer);
        serviceManager = mock(ServiceManager);
        experimentsManager = mock(ExperimentsManager);
        configurationService = mock(ConfigurationService);

        when(serviceContainer.get<IConfigurationService>(IConfigurationService)).thenReturn(
            instance(configurationService)
        );
        when(serviceContainer.get<IExperimentsManager>(IExperimentsManager)).thenReturn(instance(experimentsManager));
    });

    test('Execution command settings API returns expected array if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: 'settingValue' } as any);

        const interpreterPath = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).settings.getExecutionCommand(resource);

        assert.deepEqual(interpreterPath, ['settingValue']);
    });

    test('Execution command settings API returns `undefined` if interpreter is set', async () => {
        const resource = Uri.parse('a');
        when(configurationService.getSettings(resource)).thenReturn({ pythonPath: '' } as any);

        const interpreterPath = buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).settings.getExecutionCommand(resource);

        expect(interpreterPath).to.equal(undefined, '');
    });

    test('Test debug launcher args (no-wait and not in experiment)', async () => {
        const waitForAttach = false;
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [expectedLauncherPath, '--default', '--host', ptvsdHost, '--port', ptvsdPort.toString()];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (no-wait and in experiment)', async () => {
        const waitForAttach = false;
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [ptvsdPath.fileToCommandArgument(), '--listen', `${ptvsdHost}:${ptvsdPort}`];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and not in experiment)', async () => {
        const waitForAttach = true;
        when(experimentsManager.inExperiment(anyString())).thenReturn(false);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [
            expectedLauncherPath,
            '--default',
            '--host',
            ptvsdHost,
            '--port',
            ptvsdPort.toString(),
            '--wait'
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });

    test('Test debug launcher args (wait and in experiment)', async () => {
        const waitForAttach = true;
        when(experimentsManager.inExperiment(anyString())).thenReturn(true);

        const args = await buildApi(
            Promise.resolve(),
            instance(serviceManager),
            instance(serviceContainer)
        ).debug.getRemoteLauncherCommand(ptvsdHost, ptvsdPort, waitForAttach);
        const expectedArgs = [
            ptvsdPath.fileToCommandArgument(),
            '--listen',
            `${ptvsdHost}:${ptvsdPort}`,
            '--wait-for-client'
        ];

        expect(args).to.be.deep.equal(expectedArgs);
    });
});
