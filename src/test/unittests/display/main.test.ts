// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { StatusBarItem, Uri } from 'vscode';
import { IApplicationShell } from '../../../client/common/application/types';
import { Commands } from '../../../client/common/constants';
import { noop } from '../../../client/common/core.utils';
import { createDeferred } from '../../../client/common/helpers';
import { IConfigurationService, IPythonSettings, IUnitTestSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { CANCELLATION_REASON } from '../../../client/unittests/common/constants';
import { ITestsHelper, Tests } from '../../../client/unittests/common/types';
import { TestResultDisplay } from '../../../client/unittests/display/main';
import { sleep } from '../../core';

suite('Unit Tests - TestResultDisplay', () => {
    const workspaceUri = Uri.file(__filename);
    let appShell: typeMoq.IMock<IApplicationShell>;
    let unitTestSettings: typeMoq.IMock<IUnitTestSettings>;
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let display: TestResultDisplay;
    let testsHelper: typeMoq.IMock<ITestsHelper>;
    let configurationService: typeMoq.IMock<IConfigurationService>;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        configurationService = typeMoq.Mock.ofType<IConfigurationService>();
        appShell = typeMoq.Mock.ofType<IApplicationShell>();
        unitTestSettings = typeMoq.Mock.ofType<IUnitTestSettings>();
        const pythonSettings = typeMoq.Mock.ofType<IPythonSettings>();
        testsHelper = typeMoq.Mock.ofType<ITestsHelper>();

        pythonSettings.setup(p => p.unitTest).returns(() => unitTestSettings.object);
        configurationService.setup(c => c.getSettings(workspaceUri)).returns(() => pythonSettings.object);

        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IConfigurationService))).returns(() => configurationService.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(ITestsHelper))).returns(() => testsHelper.object);
    });
    teardown(() => {
        try {
            display.dispose();
        } catch { noop(); }
    });
    function createTestResultDisplay() {
        display = new TestResultDisplay(serviceContainer.object);
    }
    test('Should create a status bar item upon instantiation', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        appShell.verifyAll();
    });
    test('Should be disabled upon instantiation', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        appShell.verifyAll();
        expect(display.enabled).to.be.equal(false, 'not disabled');
    });
    test('Enable display should show the statusbar', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        display.enabled = true;
        statusBar.verifyAll();
    });
    test('Disable display should hide the statusbar', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.hide()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        display.enabled = false;
        statusBar.verifyAll();
    });
    test('Ensure status bar is displayed and updated with progress with ability to stop tests', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        display.displayProgressStatus(createDeferred<Tests>().promise, false);

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());
    });
    test('Ensure status bar is updated with success with ability to view ui without any results', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayProgressStatus(def.promise, false);

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());

        const tests = typeMoq.Mock.ofType<Tests>();
        tests.setup((t: any) => t.then).returns(() => undefined);
        tests.setup(t => t.summary).returns(() => {
            return { errors: 0, failures: 0, passed: 0, skipped: 0 };
        }).verifiable(typeMoq.Times.atLeastOnce());

        appShell.setup(a => a.showWarningMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.once());

        def.resolve(tests.object);
        await sleep(1);

        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    });
    test('Ensure status bar is updated with success with ability to view ui with results', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayProgressStatus(def.promise, false);

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());

        const tests = typeMoq.Mock.ofType<Tests>();
        tests.setup((t: any) => t.then).returns(() => undefined);
        tests.setup(t => t.summary).returns(() => {
            return { errors: 0, failures: 0, passed: 1, skipped: 0 };
        }).verifiable(typeMoq.Times.atLeastOnce());

        appShell.setup(a => a.showWarningMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.never());

        def.resolve(tests.object);
        await sleep(1);

        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    });
    test('Ensure status bar is updated with error when cancelled by user with ability to view ui with results', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayProgressStatus(def.promise, false);

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());

        testsHelper.setup(t => t.displayTestErrorMessage(typeMoq.It.isAny())).verifiable(typeMoq.Times.never());

        def.reject(CANCELLATION_REASON);
        await sleep(1);

        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        testsHelper.verifyAll();
    });
    test('Ensure status bar is updated, and error message display with error in running tests, with ability to view ui with results', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayProgressStatus(def.promise, false);

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Test), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Running Tests'), typeMoq.Times.atLeastOnce());

        testsHelper.setup(t => t.displayTestErrorMessage(typeMoq.It.isAny())).verifiable(typeMoq.Times.once());

        def.reject('Some other reason');
        await sleep(1);

        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        testsHelper.verifyAll();
    });

    test('Ensure status bar is displayed and updated with progress with ability to stop test discovery', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        display.displayDiscoverStatus(createDeferred<Tests>().promise, false).ignoreErrors();

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());
    });
    test('Ensure status bar is displayed and updated with success and no tests, with ability to view ui to view results of test discovery', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayDiscoverStatus(def.promise, false).ignoreErrors();

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());

        const tests = typeMoq.Mock.ofType<Tests>();
        appShell.setup(a => a.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(typeMoq.Times.once());

        def.resolve(undefined as any);
        await sleep(1);

        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
    });
    test('Ensure tests are disabled when there are errors and user choses to disable tests', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayDiscoverStatus(def.promise, false).ignoreErrors();

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());

        const tests = typeMoq.Mock.ofType<Tests>();
        appShell.setup(a => a.showInformationMessage(typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((msg, item) => Promise.resolve(item))
            .verifiable(typeMoq.Times.once());

        for (const setting of ['unitTest.promptToConfigure', 'unitTest.pyTestEnabled',
            'unitTest.unittestEnabled', 'unitTest.nosetestsEnabled']) {
            configurationService.setup(c => c.updateSettingAsync(typeMoq.It.isValue(setting), typeMoq.It.isValue(false)))
                .returns(() => Promise.resolve())
                .verifiable(typeMoq.Times.once());
        }
        def.resolve(undefined as any);
        await sleep(1);

        tests.verifyAll();
        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_View_UI), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    });
    test('Ensure status bar is displayed and updated with error info when test discovery is cancelled by the user', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayDiscoverStatus(def.promise, false).ignoreErrors();

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());

        appShell.setup(a => a.showErrorMessage(typeMoq.It.isAny()))
            .verifiable(typeMoq.Times.never());

        def.reject(CANCELLATION_REASON);
        await sleep(1);

        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Discover), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    });
    test('Ensure status bar is displayed and updated with error info, and message is displayed when test discovery is fails due to errors', async () => {
        const statusBar = typeMoq.Mock.ofType<StatusBarItem>();
        appShell.setup(a => a.createStatusBarItem(typeMoq.It.isAny()))
            .returns(() => statusBar.object)
            .verifiable(typeMoq.Times.once());

        statusBar.setup(s => s.show()).verifiable(typeMoq.Times.once());

        createTestResultDisplay();
        const def = createDeferred<Tests>();

        display.displayDiscoverStatus(def.promise, false).ignoreErrors();

        statusBar.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Ask_To_Stop_Discovery), typeMoq.Times.atLeastOnce());
        statusBar.verify(s => s.text = typeMoq.It.isValue('$(stop) Discovering Tests'), typeMoq.Times.atLeastOnce());

        appShell.setup(a => a.showErrorMessage(typeMoq.It.isAny()))
            .verifiable(typeMoq.Times.once());

        def.reject('some weird error');
        await sleep(1);

        appShell.verifyAll();
        statusBar.verify(s => s.command = typeMoq.It.isValue(Commands.Tests_Discover), typeMoq.Times.atLeastOnce());
        configurationService.verifyAll();
    });
});
