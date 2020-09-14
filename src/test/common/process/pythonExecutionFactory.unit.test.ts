// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as assert from 'assert';
import { expect } from 'chai';
import { parse, SemVer } from 'semver';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { Uri } from 'vscode';

import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { IPlatformService } from '../../../client/common/platform/types';
import { BufferDecoder } from '../../../client/common/process/decoder';
import { ProcessLogger } from '../../../client/common/process/logger';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { PythonDaemonExecutionServicePool } from '../../../client/common/process/pythonDaemonPool';
import { PythonExecutionFactory } from '../../../client/common/process/pythonExecutionFactory';
import {
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonExecutionService
} from '../../../client/common/process/types';
import { IConfigurationService, IDisposableRegistry } from '../../../client/common/types';
import { Architecture } from '../../../client/common/utils/platform';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IWindowsStoreInterpreter } from '../../../client/interpreter/locators/types';
import { ServiceContainer } from '../../../client/ioc/container';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';

// tslint:disable:no-any max-func-body-length chai-vague-errors

const pythonInterpreter: PythonEnvironment = {
    path: '/foo/bar/python.exe',
    version: new SemVer('3.6.6-final'),
    sysVersion: '1.0.0.0',
    sysPrefix: 'Python',
    envType: EnvironmentType.Unknown,
    architecture: Architecture.x64
};

function title(resource?: Uri, interpreter?: PythonEnvironment) {
    return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
}

async function verifyCreateActivated(
    factory: PythonExecutionFactory,
    activationHelper: IEnvironmentActivationService,
    resource?: Uri,
    interpreter?: PythonEnvironment
): Promise<IPythonExecutionService> {
    when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve();

    const service = await factory.createActivatedEnvironment({ resource, interpreter });

    verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();

    return service;
}

suite('Process - PythonExecutionFactory', () => {
    [
        { resource: undefined, interpreter: undefined },
        { resource: undefined, interpreter: pythonInterpreter },
        { resource: Uri.parse('x'), interpreter: undefined },
        { resource: Uri.parse('x'), interpreter: pythonInterpreter }
    ].forEach((item) => {
        const resource = item.resource;
        const interpreter = item.interpreter;
        suite(title(resource, interpreter), () => {
            let factory: PythonExecutionFactory;
            let activationHelper: IEnvironmentActivationService;
            let bufferDecoder: IBufferDecoder;
            let processFactory: IProcessServiceFactory;
            let configService: IConfigurationService;
            let processLogger: IProcessLogger;
            let processService: typemoq.IMock<IProcessService>;
            let windowsStoreInterpreter: IWindowsStoreInterpreter;
            let interpreterService: IInterpreterService;
            let executionService: typemoq.IMock<IPythonExecutionService>;
            let platformService: IPlatformService;
            setup(() => {
                bufferDecoder = mock(BufferDecoder);
                processFactory = mock(ProcessServiceFactory);
                configService = mock(ConfigurationService);
                processLogger = mock(ProcessLogger);
                platformService = mock<IPlatformService>();
                executionService = typemoq.Mock.ofType<IPythonExecutionService>();
                executionService.setup((p: any) => p.then).returns(() => undefined);
                when(processLogger.logProcess('', [], {})).thenReturn();
                processService = typemoq.Mock.ofType<IProcessService>();
                processService
                    .setup((p) =>
                        p.on('exec', () => {
                            return;
                        })
                    )
                    .returns(() => processService.object);
                processService.setup((p: any) => p.then).returns(() => undefined);
                interpreterService = mock<IInterpreterService>();
                when(interpreterService.getInterpreterDetails(anything())).thenResolve({
                    version: { major: 3 }
                } as any);
                const serviceContainer = mock(ServiceContainer);
                when(serviceContainer.get<IDisposableRegistry>(IDisposableRegistry)).thenReturn([]);
                when(serviceContainer.get<IProcessLogger>(IProcessLogger)).thenReturn(processLogger);
                when(serviceContainer.get<IInterpreterService>(IInterpreterService)).thenReturn(
                    instance(interpreterService)
                );
                when(serviceContainer.tryGet<IInterpreterService>(IInterpreterService)).thenReturn(
                    instance(interpreterService)
                );
                factory = new PythonExecutionFactory(
                    instance(serviceContainer),
                    instance(activationHelper),
                    instance(processFactory),
                    instance(configService),
                    instance(bufferDecoder),
                    instance(windowsStoreInterpreter),
                    instance(platformService)
                );
            });
            teardown(() => sinon.restore());
            test('Ensure PythonExecutionService is created', async () => {
                const pythonSettings = mock(PythonSettings);
                when(processFactory.create(resource)).thenResolve(processService.object);
                when(activationHelper.getActivatedEnvironmentVariables(resource)).thenResolve({ x: '1' });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
            });
            test('Ensure we use an existing `create` method if there are no environment variables for the activated env', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const service = await verifyCreateActivated(factory, activationHelper, resource, interpreter);
                assert.deepEqual(service, mockExecService);
                assert.equal(createInvoked, true);
            });
            test('Ensure we use an existing `create` method if there are no environment variables (0 length) for the activated env', async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));

                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const service = await verifyCreateActivated(factory, activationHelper, resource, interpreter);
                assert.deepEqual(service, mockExecService);
                assert.equal(createInvoked, true);
            });
            test('PythonExecutionService is created', async () => {
                let createInvoked = false;
                const mockExecService = 'something';
                factory.create = async (_options: ExecutionFactoryCreationOptions) => {
                    createInvoked = true;
                    return Promise.resolve((mockExecService as any) as IPythonExecutionService);
                };

                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                const service = await factory.createActivatedEnvironment({ resource, interpreter });

                expect(service).to.not.equal(undefined);
                verify(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).once();
                if (!interpreter) {
                    verify(pythonSettings.pythonPath).once();
                }
                assert.equal(createInvoked, false);
            });

            test("Ensure `create` returns a WindowsStorePythonProcess instance if it's a windows store intepreter path", async () => {
                const pythonPath = 'path/to/python';
                const pythonSettings = mock(PythonSettings);

                when(processFactory.create(resource)).thenResolve(processService.object);
                when(pythonSettings.pythonPath).thenReturn(pythonPath);
                when(configService.getSettings(resource)).thenReturn(instance(pythonSettings));
                when(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).thenResolve(true);

                const service = await factory.create({ resource });

                expect(service).to.not.equal(undefined);
                verify(processFactory.create(resource)).once();
                verify(pythonSettings.pythonPath).once();
                verify(windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)).once();
            });

            test('Create Daemon Service an invoke initialize', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(executionService.object);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon = await factory.createDaemon({ resource, pythonPath: item.interpreter?.path });

                expect(daemon).instanceOf(PythonDaemonExecutionServicePool);
                expect(initialize.callCount).to.equal(1);
            });
            test('Do not create Daemon Service for Python 2.7', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                reset(interpreterService);
                when(interpreterService.getInterpreterDetails(anything(), anything())).thenResolve({
                    version: parse('2.7.14')
                } as any);
                factory.createActivatedEnvironment = () => Promise.resolve(executionService.object);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon = await factory.createDaemon({ resource, pythonPath: item.interpreter?.path });

                expect(daemon).not.instanceOf(PythonDaemonExecutionServicePool);
                expect(initialize.callCount).to.equal(0);
            });
            test('Create Daemon Service should return the same daemon when created one after another', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(executionService.object);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon1 = await factory.createDaemon({ resource, pythonPath: item.interpreter?.path });
                const daemon2 = await factory.createDaemon({ resource, pythonPath: item.interpreter?.path });

                expect(daemon1).to.equal(daemon2);
            });
            test('Create Daemon Service should return two different daemons (if python path is different)', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(executionService.object);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const daemon1 = await factory.createDaemon({ resource });

                when(pythonSettings.pythonPath).thenReturn('HELLO2');
                const daemon2 = await factory.createDaemon({ resource });

                expect(daemon1).to.not.equal(daemon2);
            });
            test('Create Daemon Service should return the same daemon when created in parallel', async () => {
                const pythonSettings = mock(PythonSettings);
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(executionService.object);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.resolve());

                const [daemon1, daemon2] = await Promise.all([
                    factory.createDaemon({ resource, pythonPath: item.interpreter?.path }),
                    factory.createDaemon({ resource, pythonPath: item.interpreter?.path })
                ]);

                expect(daemon1).to.equal(daemon2);
            });
            test('Failure to create Daemon Service should return PythonExecutionService', async () => {
                const pythonSettings = mock(PythonSettings);
                const pythonExecService = ({ dummy: 1 } as any) as IPythonExecutionService;
                when(activationHelper.getActivatedEnvironmentVariables(resource, anything(), anything())).thenResolve({
                    x: '1'
                });
                when(pythonSettings.pythonPath).thenReturn('HELLO');
                when(configService.getSettings(anything())).thenReturn(instance(pythonSettings));
                factory.createActivatedEnvironment = () => Promise.resolve(pythonExecService);

                const initialize = sinon.stub(PythonDaemonExecutionServicePool.prototype, 'initialize');
                initialize.returns(Promise.reject(new Error('Kaboom')));

                const daemon = await factory.createDaemon({ resource, pythonPath: item.interpreter?.path });

                expect(daemon).not.instanceOf(PythonDaemonExecutionServicePool);
                expect(initialize.callCount).to.equal(1);
                expect(daemon).equal(pythonExecService);
            });
        });
    });
});
