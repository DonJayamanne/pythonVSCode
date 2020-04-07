// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPlatformService } from '../../../client/common/platform/types';
import { IBrowserService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { createDeferred, createDeferredFromPromise, sleep } from '../../../client/common/utils/async';
import { Common, Interpreters } from '../../../client/common/utils/localize';
import { IInterpreterService, InterpreterType } from '../../../client/interpreter/contracts';
import {
    CondaInheritEnvPrompt,
    condaInheritEnvPromptKey
} from '../../../client/interpreter/virtualEnvs/condaInheritEnvPrompt';

// tslint:disable:no-any

// tslint:disable:max-func-body-length
suite('Conda Inherit Env Prompt', async () => {
    const resource = Uri.file('a');
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let platformService: TypeMoq.IMock<IPlatformService>;
    let browserService: TypeMoq.IMock<IBrowserService>;
    let persistentStateFactory: IPersistentStateFactory;
    let notificationPromptEnabled: TypeMoq.IMock<IPersistentState<any>>;
    let condaInheritEnvPrompt: CondaInheritEnvPrompt;
    function verifyAll() {
        workspaceService.verifyAll();
        appShell.verifyAll();
        interpreterService.verifyAll();
    }

    suite('Method shouldShowPrompt()', () => {
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            browserService = TypeMoq.Mock.ofType<IBrowserService>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            persistentStateFactory = mock(PersistentStateFactory);
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );
        });
        test('Returns false if prompt has already been shown in the current session', async () => {
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object,
                true
            );
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => Promise.resolve(undefined) as any)
                .verifiable(TypeMoq.Times.never());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(true, 'Should be true');
            verifyAll();
        });
        test('Returns false if on Windows', async () => {
            platformService
                .setup(ps => ps.isWindows)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(false, 'Should be false');
            verifyAll();
        });
        test('Returns false if active interpreter is not of type Conda', async () => {
            const interpreter = {
                type: InterpreterType.Pipenv
            };
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            platformService
                .setup(ps => ps.isWindows)
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => Promise.resolve(interpreter) as any)
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(false, 'Should be false');
            verifyAll();
        });
        test('Returns false if no active interpreter is present', async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            platformService
                .setup(ps => ps.isWindows)
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(false, 'Should be false');
            verifyAll();
        });
        test('Returns false if settings returned is `undefined`', async () => {
            const interpreter = {
                type: InterpreterType.Conda
            };
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            platformService
                .setup(ps => ps.isWindows)
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => Promise.resolve(interpreter) as any)
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.once());
            workspaceConfig
                .setup(ws => ws.inspect<boolean>('integrated.inheritEnv'))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(false, 'Should be false');
            verifyAll();
        });
        [
            {
                name: 'Returns false if globalValue `terminal.integrated.inheritEnv` setting is set',
                settings: {
                    globalValue: true,
                    workspaceValue: undefined,
                    workspaceFolderValue: undefined
                }
            },
            {
                name: 'Returns false if workspaceValue of `terminal.integrated.inheritEnv` setting is set',
                settings: {
                    globalValue: undefined,
                    workspaceValue: true,
                    workspaceFolderValue: undefined
                }
            },
            {
                name: 'Returns false if workspaceFolderValue of `terminal.integrated.inheritEnv` setting is set',
                settings: {
                    globalValue: undefined,
                    workspaceValue: undefined,
                    workspaceFolderValue: false
                }
            }
        ].forEach(testParams => {
            test(testParams.name, async () => {
                const interpreter = {
                    type: InterpreterType.Conda
                };
                const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
                platformService
                    .setup(ps => ps.isWindows)
                    .returns(() => false)
                    .verifiable(TypeMoq.Times.once());
                interpreterService
                    .setup(is => is.getActiveInterpreter(resource))
                    .returns(() => Promise.resolve(interpreter) as any)
                    .verifiable(TypeMoq.Times.once());
                workspaceService
                    .setup(ws => ws.getConfiguration('terminal', resource))
                    .returns(() => workspaceConfig.object)
                    .verifiable(TypeMoq.Times.once());
                workspaceConfig
                    .setup(ws => ws.inspect<boolean>('integrated.inheritEnv'))
                    .returns(() => testParams.settings as any);
                const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
                expect(result).to.equal(false, 'Prompt should not be shown');
                expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(false, 'Should be false');
                verifyAll();
            });
        });
        test('Returns true otherwise', async () => {
            const interpreter = {
                type: InterpreterType.Conda
            };
            const settings = {
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            };
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            platformService
                .setup(ps => ps.isWindows)
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => Promise.resolve(interpreter) as any)
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.once());
            workspaceConfig.setup(ws => ws.inspect<boolean>('integrated.inheritEnv')).returns(() => settings as any);
            const result = await condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(true, 'Prompt should be shown');
            expect(condaInheritEnvPrompt.hasPromptBeenShownInCurrentSession).to.equal(true, 'Should be true');
            verifyAll();
        });
    });
    suite('Method activate()', () => {
        let initializeInBackground: sinon.SinonStub<any>;
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            browserService = TypeMoq.Mock.ofType<IBrowserService>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            persistentStateFactory = mock(PersistentStateFactory);
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
        });

        teardown(() => {
            sinon.restore();
        });

        test('Invokes initializeInBackground() in the background', async () => {
            const initializeInBackgroundDeferred = createDeferred<void>();
            initializeInBackground = sinon.stub(CondaInheritEnvPrompt.prototype, 'initializeInBackground');
            initializeInBackground.callsFake(() => initializeInBackgroundDeferred.promise);
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );

            const promise = condaInheritEnvPrompt.activate(resource);
            const deferred = createDeferredFromPromise(promise);
            await sleep(1);

            // Ensure activate() function has completed while initializeInBackground() is still not resolved
            assert.equal(deferred.completed, true);

            initializeInBackgroundDeferred.resolve();
            await sleep(1);
            assert.ok(initializeInBackground.calledOnce);
        });

        test('Ignores errors raised by initializeInBackground()', async () => {
            initializeInBackground = sinon.stub(CondaInheritEnvPrompt.prototype, 'initializeInBackground');
            initializeInBackground.rejects(new Error('Kaboom'));
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );
            await condaInheritEnvPrompt.activate(resource);
            assert.ok(initializeInBackground.calledOnce);
        });
    });

    suite('Method initializeInBackground()', () => {
        let shouldShowPrompt: sinon.SinonStub<any>;
        let promptAndUpdate: sinon.SinonStub<any>;
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            browserService = TypeMoq.Mock.ofType<IBrowserService>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            persistentStateFactory = mock(PersistentStateFactory);
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
        });

        teardown(() => {
            sinon.restore();
        });

        test('Show prompt if shouldShowPrompt() returns true', async () => {
            shouldShowPrompt = sinon.stub(CondaInheritEnvPrompt.prototype, 'shouldShowPrompt');
            shouldShowPrompt.callsFake(() => Promise.resolve(true));
            promptAndUpdate = sinon.stub(CondaInheritEnvPrompt.prototype, 'promptAndUpdate');
            promptAndUpdate.callsFake(() => Promise.resolve(undefined));
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );
            await condaInheritEnvPrompt.initializeInBackground(resource);
            assert.ok(shouldShowPrompt.calledOnce);
            assert.ok(promptAndUpdate.calledOnce);
        });

        test('Do not show prompt if shouldShowPrompt() returns false', async () => {
            shouldShowPrompt = sinon.stub(CondaInheritEnvPrompt.prototype, 'shouldShowPrompt');
            shouldShowPrompt.callsFake(() => Promise.resolve(false));
            promptAndUpdate = sinon.stub(CondaInheritEnvPrompt.prototype, 'promptAndUpdate');
            promptAndUpdate.callsFake(() => Promise.resolve(undefined));
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );
            await condaInheritEnvPrompt.initializeInBackground(resource);
            assert.ok(shouldShowPrompt.calledOnce);
            assert.ok(promptAndUpdate.notCalled);
        });
    });

    suite('Method promptAndUpdate()', () => {
        const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.moreInfo()];
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            persistentStateFactory = mock(PersistentStateFactory);
            browserService = TypeMoq.Mock.ofType<IBrowserService>();
            notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<any>>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            when(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).thenReturn(
                notificationPromptEnabled.object
            );
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(
                interpreterService.object,
                workspaceService.object,
                browserService.object,
                appShell.object,
                instance(persistentStateFactory),
                platformService.object
            );
        });

        test('Does not display prompt if it is disabled', async () => {
            notificationPromptEnabled
                .setup(n => n.value)
                .returns(() => false)
                .verifiable(TypeMoq.Times.once());
            appShell
                .setup(a => a.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            await condaInheritEnvPrompt.promptAndUpdate();
            verify(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).once();
            verifyAll();
            notificationPromptEnabled.verifyAll();
        });
        test('Do nothing if no option is selected', async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            notificationPromptEnabled
                .setup(n => n.value)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            appShell
                .setup(a => a.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal'))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            workspaceConfig
                .setup(wc => wc.update('integrated.inheritEnv', false, ConfigurationTarget.Global))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            notificationPromptEnabled
                .setup(n => n.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            browserService
                .setup(b => b.launch('https://aka.ms/AA66i8f'))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.never());
            await condaInheritEnvPrompt.promptAndUpdate();
            verify(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).once();
            verifyAll();
            workspaceConfig.verifyAll();
            notificationPromptEnabled.verifyAll();
            browserService.verifyAll();
        });
        test('Update terminal settings if `Yes` is selected', async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            notificationPromptEnabled
                .setup(n => n.value)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            appShell
                .setup(a => a.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts))
                .returns(() => Promise.resolve(Common.bannerLabelYes()))
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal'))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.once());
            workspaceConfig
                .setup(wc => wc.update('integrated.inheritEnv', false, ConfigurationTarget.Global))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.once());
            notificationPromptEnabled
                .setup(n => n.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            browserService
                .setup(b => b.launch('https://aka.ms/AA66i8f'))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.never());
            await condaInheritEnvPrompt.promptAndUpdate();
            verify(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).once();
            verifyAll();
            workspaceConfig.verifyAll();
            notificationPromptEnabled.verifyAll();
            browserService.verifyAll();
        });
        test('Disable notification prompt if `No` is selected', async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            notificationPromptEnabled
                .setup(n => n.value)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            appShell
                .setup(a => a.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts))
                .returns(() => Promise.resolve(Common.bannerLabelNo()))
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal'))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            workspaceConfig
                .setup(wc => wc.update('integrated.inheritEnv', false, ConfigurationTarget.Global))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            notificationPromptEnabled
                .setup(n => n.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.once());
            browserService
                .setup(b => b.launch('https://aka.ms/AA66i8f'))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.never());
            await condaInheritEnvPrompt.promptAndUpdate();
            verify(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).once();
            verifyAll();
            workspaceConfig.verifyAll();
            notificationPromptEnabled.verifyAll();
            browserService.verifyAll();
        });
        test('Launch browser if `More info` option is selected', async () => {
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            notificationPromptEnabled
                .setup(n => n.value)
                .returns(() => true)
                .verifiable(TypeMoq.Times.once());
            appShell
                .setup(a => a.showInformationMessage(Interpreters.condaInheritEnvMessage(), ...prompts))
                .returns(() => Promise.resolve(Common.moreInfo()))
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal'))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.never());
            workspaceConfig
                .setup(wc => wc.update('integrated.inheritEnv', false, ConfigurationTarget.Global))
                .returns(() => Promise.resolve())
                .verifiable(TypeMoq.Times.never());
            notificationPromptEnabled
                .setup(n => n.updateValue(false))
                .returns(() => Promise.resolve(undefined))
                .verifiable(TypeMoq.Times.never());
            browserService
                .setup(b => b.launch('https://aka.ms/AA66i8f'))
                .returns(() => undefined)
                .verifiable(TypeMoq.Times.once());
            await condaInheritEnvPrompt.promptAndUpdate();
            verify(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).once();
            verifyAll();
            workspaceConfig.verifyAll();
            notificationPromptEnabled.verifyAll();
            browserService.verifyAll();
        });
    });
});
