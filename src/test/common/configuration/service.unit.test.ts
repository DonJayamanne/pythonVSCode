// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { DeprecatePythonPath } from '../../../client/common/experimentGroups';
import { IExperimentsManager, IInterpreterPathService } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Configuration Service', () => {
    const resource = Uri.parse('a');
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let interpreterPathService: TypeMoq.IMock<IInterpreterPathService>;
    let experimentsManager: TypeMoq.IMock<IExperimentsManager>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let configService: ConfigurationService;
    setup(() => {
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup(w => w.getWorkspaceFolder(resource))
            .returns(() => ({
                uri: resource,
                index: 0,
                name: '0'
            }));
        interpreterPathService = TypeMoq.Mock.ofType<IInterpreterPathService>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        experimentsManager = TypeMoq.Mock.ofType<IExperimentsManager>();
        experimentsManager
            .setup(e => e.sendTelemetryIfInExperiment(DeprecatePythonPath.control))
            .returns(() => undefined);
        serviceContainer.setup(s => s.get(IWorkspaceService)).returns(() => workspaceService.object);
        serviceContainer.setup(s => s.get(IInterpreterPathService)).returns(() => interpreterPathService.object);
        serviceContainer.setup(s => s.get(IExperimentsManager)).returns(() => experimentsManager.object);
        configService = new ConfigurationService(serviceContainer.object);
    });

    function setupConfigProvider(): TypeMoq.IMock<WorkspaceConfiguration> {
        const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        workspaceService
            .setup(w => w.getConfiguration(TypeMoq.It.isValue('python'), TypeMoq.It.isValue(resource)))
            .returns(() => workspaceConfig.object);
        return workspaceConfig;
    }

    test('Do not update global settings if global value is already equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        // tslint:disable-next-line: no-any
        workspaceConfig.setup(w => w.inspect('setting')).returns(() => ({ globalValue: 'globalValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'globalValue', ConfigurationTarget.Global))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await configService.updateSetting('setting', 'globalValue', resource, ConfigurationTarget.Global);

        workspaceConfig.verifyAll();
    });

    test('Update global settings if global value is not equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        // tslint:disable-next-line: no-any
        workspaceConfig.setup(w => w.inspect('setting')).returns(() => ({ globalValue: 'globalValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'newGlobalValue', ConfigurationTarget.Global))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await configService.updateSetting('setting', 'newGlobalValue', resource, ConfigurationTarget.Global);

        workspaceConfig.verifyAll();
    });

    test('Do not update workspace settings if workspace value is already equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        // tslint:disable-next-line: no-any
        workspaceConfig.setup(w => w.inspect('setting')).returns(() => ({ workspaceValue: 'workspaceValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'workspaceValue', ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await configService.updateSetting('setting', 'workspaceValue', resource, ConfigurationTarget.Workspace);

        workspaceConfig.verifyAll();
    });

    test('Update workspace settings if workspace value is not equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        // tslint:disable-next-line: no-any
        workspaceConfig.setup(w => w.inspect('setting')).returns(() => ({ workspaceValue: 'workspaceValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'newWorkspaceValue', ConfigurationTarget.Workspace))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await configService.updateSetting('setting', 'newWorkspaceValue', resource, ConfigurationTarget.Workspace);

        workspaceConfig.verifyAll();
    });

    test('Do not update workspace folder settings if workspace folder value is already equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        workspaceConfig
            .setup(w => w.inspect('setting'))
            // tslint:disable-next-line: no-any
            .returns(() => ({ workspaceFolderValue: 'workspaceFolderValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'workspaceFolderValue', ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await configService.updateSetting(
            'setting',
            'workspaceFolderValue',
            resource,
            ConfigurationTarget.WorkspaceFolder
        );

        workspaceConfig.verifyAll();
    });

    test('Update workspace folder settings if workspace folder value is not equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => false);
        const workspaceConfig = setupConfigProvider();
        workspaceConfig
            .setup(w => w.inspect('setting'))
            // tslint:disable-next-line: no-any
            .returns(() => ({ workspaceFolderValue: 'workspaceFolderValue' } as any));
        workspaceConfig
            .setup(w => w.update('setting', 'newWorkspaceFolderValue', ConfigurationTarget.WorkspaceFolder))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await configService.updateSetting(
            'setting',
            'newWorkspaceFolderValue',
            resource,
            ConfigurationTarget.WorkspaceFolder
        );

        workspaceConfig.verifyAll();
    });

    test('If in Deprecate PythonPath experiment & setting to update is `python.pythonPath`, update settings using new API if stored value is not equal to the new value', async () => {
        experimentsManager.setup(e => e.inExperiment(DeprecatePythonPath.experiment)).returns(() => true);
        interpreterPathService
            .setup(w => w.inspect(resource))
            // tslint:disable-next-line: no-any
            .returns(() => ({ workspaceFolderValue: 'workspaceFolderValue' } as any));
        interpreterPathService
            .setup(w => w.update(resource, ConfigurationTarget.WorkspaceFolder, 'newWorkspaceFolderValue'))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await configService.updateSetting(
            'pythonPath',
            'newWorkspaceFolderValue',
            resource,
            ConfigurationTarget.WorkspaceFolder
        );

        interpreterPathService.verifyAll();
    });
});
