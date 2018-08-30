import { assert, expect, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';
import { createDeferred } from '../../client/common/helpers';
import { TestManagerRunner as NoseTestManagerRunner } from '../../client/unittests//nosetest/runner';
import { TestManagerRunner as PytestManagerRunner } from '../../client/unittests//pytest/runner';
import { TestManagerRunner as UnitTestTestManagerRunner } from '../../client/unittests//unittest/runner';
import { ArgumentsHelper } from '../../client/unittests/common/argumentsHelper';
import { CANCELLATION_REASON, CommandSource, NOSETEST_PROVIDER, PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../client/unittests/common/constants';
import { TestRunner } from '../../client/unittests/common/runner';
import { ITestDebugLauncher, ITestManagerFactory, ITestRunner, IXUnitParser, TestProvider } from '../../client/unittests/common/types';
import { XUnitParser } from '../../client/unittests/common/xUnitParser';
import { ArgumentsService as NoseTestArgumentsService } from '../../client/unittests/nosetest/services/argsService';
import { ArgumentsService as PyTestArgumentsService } from '../../client/unittests/pytest/services/argsService';
import { IArgumentsHelper, IArgumentsService, ITestManagerRunner, IUnitTestHelper } from '../../client/unittests/types';
import { UnitTestHelper } from '../../client/unittests/unittest/helper';
import { ArgumentsService as UnitTestArgumentsService } from '../../client/unittests/unittest/services/argsService';
import { deleteDirectory, rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { MockDebugLauncher } from './mocks';
import { UnitTestIocContainer } from './serviceRegistry';

use(chaiAsPromised);

const testFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'debuggerTest');
const defaultUnitTestArgs = [
    '-v',
    '-s',
    '.',
    '-p',
    '*test*.py'
];

// tslint:disable-next-line:max-func-body-length
suite('Unit Tests - debugging', () => {
    let ioc: UnitTestIocContainer;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(async function () {
        // Test disvovery is where the delay is, hence give 10 seconds (as we discover tests at least twice in each test).
        // tslint:disable-next-line:no-invalid-this
        this.timeout(10000);
        await initialize();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });
    setup(async () => {
        await deleteDirectory(path.join(testFilesPath, '.cache'));
        await initializeTest();
        initializeDI();
    });
    teardown(async () => {
        ioc.dispose();
        await updateSetting('unitTest.unittestArgs', defaultUnitTestArgs, rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await updateSetting('unitTest.pyTestArgs', [], rootWorkspaceUri, configTarget);
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();

        ioc.registerTestParsers();
        ioc.registerTestVisitors();
        ioc.registerTestDiscoveryServices();
        ioc.registerTestResultsHelper();
        ioc.registerTestStorage();
        ioc.registerTestsHelper();
        ioc.registerTestManagers();
        ioc.registerMockUnitTestSocketServer();
        ioc.serviceManager.add<IArgumentsHelper>(IArgumentsHelper, ArgumentsHelper);
        ioc.serviceManager.add<ITestRunner>(ITestRunner, TestRunner);
        ioc.serviceManager.add<IXUnitParser>(IXUnitParser, XUnitParser);
        ioc.serviceManager.add<IUnitTestHelper>(IUnitTestHelper, UnitTestHelper);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, NoseTestArgumentsService, NOSETEST_PROVIDER);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, PyTestArgumentsService, PYTEST_PROVIDER);
        ioc.serviceManager.add<IArgumentsService>(IArgumentsService, UnitTestArgumentsService, UNITTEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, PytestManagerRunner, PYTEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, NoseTestManagerRunner, NOSETEST_PROVIDER);
        ioc.serviceManager.add<ITestManagerRunner>(ITestManagerRunner, UnitTestTestManagerRunner, UNITTEST_PROVIDER);
        ioc.serviceManager.addSingleton<ITestDebugLauncher>(ITestDebugLauncher, MockDebugLauncher);
    }

    async function testStartingDebugger(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(testProvider, rootWorkspaceUri, testFilesPath);
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const deferred = createDeferred<string>();
        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);

        // This promise should never resolve nor reject.
        runningPromise
            .then(() => deferred.reject('Debugger stopped when it shouldn\'t have'))
            .catch(error => deferred.reject(error));

        mockDebugLauncher.launched
            .then((launched) => {
                if (launched) {
                    deferred.resolve('');
                } else {
                    deferred.reject('Debugger not launched');
                }
            }).catch(error => deferred.reject(error));

        await deferred.promise;
    }

    test('Debugger should start (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('unittest');
    });

    test('Debugger should start (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('pytest');
    });

    test('Debugger should start (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testStartingDebugger('nosetest');
    });

    async function testStoppingDebugger(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(testProvider, rootWorkspaceUri, testFilesPath);
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');

        const discoveryPromise = testManager.discoverTests(CommandSource.commandPalette, true, true, true);
        await expect(runningPromise).to.be.rejectedWith(CANCELLATION_REASON, 'Incorrect reason for ending the debugger');
        ioc.dispose(); // will cancel test discovery
        await expect(discoveryPromise).to.be.rejectedWith(CANCELLATION_REASON, 'Incorrect reason for ending the debugger');
    }

    test('Debugger should stop when user invokes a test discovery (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('unittest');
    });

    test('Debugger should stop when user invokes a test discovery (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('pytest');
    });

    test('Debugger should stop when user invokes a test discovery (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testStoppingDebugger('nosetest');
    });

    async function testDebuggerWhenRediscoveringTests(testProvider: TestProvider) {
        const testManager = ioc.serviceContainer.get<ITestManagerFactory>(ITestManagerFactory)(testProvider, rootWorkspaceUri, testFilesPath);
        const mockDebugLauncher = ioc.serviceContainer.get<MockDebugLauncher>(ITestDebugLauncher);
        const tests = await testManager.discoverTests(CommandSource.commandPalette, true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuites.length, 2, 'Incorrect number of test suites');

        const testFunction = [tests.testFunctions[0].testFunction];
        const runningPromise = testManager.runTest(CommandSource.commandPalette, { testFunction }, false, true);
        const launched = await mockDebugLauncher.launched;
        assert.isTrue(launched, 'Debugger not launched');

        const discoveryPromise = testManager.discoverTests(CommandSource.commandPalette, false, true);
        const deferred = createDeferred<string>();

        discoveryPromise
            // tslint:disable-next-line:no-unsafe-any
            .then(() => deferred.resolve(''))
            // tslint:disable-next-line:no-unsafe-any
            .catch(ex => deferred.reject(ex));

        // This promise should never resolve nor reject.
        runningPromise
            .then(() => 'Debugger stopped when it shouldn\'t have')
            .catch(() => 'Debugger crashed when it shouldn\'t have')
            // tslint:disable-next-line: no-floating-promises
            .then(error => {
                deferred.reject(error);
            });

        // Should complete without any errors
        await deferred.promise;
    }

    test('Debugger should not stop when test discovery is invoked automatically by extension (unittest)', async () => {
        await updateSetting('unitTest.unittestArgs', ['-s=./tests', '-p=test_*.py'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('unittest');
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (pytest)', async () => {
        await updateSetting('unitTest.pyTestArgs', ['-k=test_'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('pytest');
    });

    test('Debugger should not stop when test discovery is invoked automatically by extension (nosetest)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m', 'test'], rootWorkspaceUri, configTarget);
        await testDebuggerWhenRediscoveringTests('nosetest');
    });
});
