/// <reference path='../../../node_modules/@types/mocha/index.d.ts'/>
//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
// Place this right on top
import { initialize, setPythonExecutable } from './../initialize';

// The module \'assert\' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TestsToRun, TestFile, TestFunction, TestSuite } from '../../client/unittests/common/contracts';
import * as pytest from '../../client/unittests/pytest/main';
import { TestResultDisplay } from '../../client/unittests/display/main';


import * as path from 'path';
import * as configSettings from '../../client/common/configSettings';
import { MockOutputChannel } from './../mockClasses';

let pythonSettings = configSettings.PythonSettings.getInstance();
const disposable = setPythonExecutable(pythonSettings);

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const UNITTEST_TEST_FILES_PATH_WITH_CONFIGS = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'unitestsWithConfigs');

suite('Unit Tests (PyTest)', () => {
    suiteSetup(done => {
        initialize().then(() => {
            done();
        });
    });
    suiteTeardown(() => {
        disposable.dispose();
    });
    setup(() => {
        rootDirectory = UNITTEST_TEST_FILES_PATH;
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
    });
    teardown(() => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
    });
    function createTestManager() {
        testManager = new pytest.TestManager(rootDirectory, outChannel);
    }
    let rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: pytest.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;

    test('Discover Tests (single test file)', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        testManager = new pytest.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel);
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 2, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_one.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
        }).then(done).catch(done);
    });

    test('Discover Tests (pattern = test_)', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 6, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 29, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 8, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_two.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_another_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
        }).then(done).catch(done);
    });

    test('Discover Tests (pattern = _test)', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=_test.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/unittest_three_test.py' && t.nameToRun === t.name), true, 'Test File not found');
        }).then(done).catch(done);
    });


    test('Discover Tests (with config)', done => {
        pythonSettings.unitTest.pyTestArgs = [];
        rootDirectory = UNITTEST_TEST_FILES_PATH_WITH_CONFIGS;
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 14, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 4, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'other/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'other/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
        }).then(done).catch(done);
    });

    test('Run Tests', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 0, 'Errors');
            assert.equal(results.summary.failures, 9, 'Failures');
            assert.equal(results.summary.passed, 17, 'Passed');
            assert.equal(results.summary.skipped, 3, 'skipped');
        }).then(done).catch(done);
    });

    test('Run Failed Tests', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 0, 'Errors');
            assert.equal(results.summary.failures, 9, 'Failures');
            assert.equal(results.summary.passed, 17, 'Passed');
            assert.equal(results.summary.skipped, 3, 'skipped');

            return testManager.runTest(true).then(tests => {
                assert.equal(results.summary.errors, 0, 'Failed Errors');
                assert.equal(results.summary.failures, 9, 'Failed Failures');
                assert.equal(results.summary.passed, 0, 'Failed Passed');
                assert.equal(results.summary.skipped, 0, 'Failed skipped');
            });
        }).then(done).catch(done);
    });

    test('Run Specific Test File', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFile: TestFile = {
                fullPath: path.join(rootDirectory, 'tests', 'test_another_pytest.py'),
                name: 'tests/test_another_pytest.py',
                nameToRun: 'tests/test_another_pytest.py',
                xmlName: 'tests/test_another_pytest.py',
                functions: [],
                suites: [],
                time: 0
            };
            const testFileToRun: TestsToRun = { testFile: [testFile], testFolder: [], testFunction: [], testSuite: [] };
            return testManager.runTest(testFileToRun).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 3, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
            });
        }).then(done).catch(done);
    });

    test('Run Specific Test Suite', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuits[0].testSuite] };
            return testManager.runTest(testSuite).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 1, 'Passed');
                assert.equal(tests.summary.skipped, 1, 'skipped');
            });
        }).then(done).catch(done);
    });

    test('Run Specific Test Function', done => {
        pythonSettings.unitTest.pyTestArgs = [
            '-k=test_'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
            return testManager.runTest(testFn).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 0, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
            });
        }).then(done).catch(done);
    });
});