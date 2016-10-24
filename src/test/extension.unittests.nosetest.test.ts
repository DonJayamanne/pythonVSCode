/// <reference path='../../node_modules/@types/mocha/index.d.ts'/>
//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
// Place this right on top
import { initialize } from './initialize';

// The module \'assert\' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TestsToRun } from '../client/unittests/common/contracts';
import * as nose from '../client/unittests/nosetest/main';
import { TestResultDisplay } from '../client/unittests/display/main';


import * as path from 'path';
import * as configSettings from '../client/common/configSettings';

let pythonSettings = configSettings.PythonSettings.getInstance();

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'unitests');
class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    name: string;
    output: string;
    append(value: string) {
        this.output += value;
    }
    appendLine(value: string) { this.append(value); this.append('\n'); }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void { }
    hide() { }
    dispose() { }
}

suite('Unit Tests (nosetest)', () => {
    suiteSetup(done => {
        initialize().then(() => {
            done();
        });
    });
    suiteTeardown(done => {
        done();
    });
    setup(() => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
    });
    teardown(() => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
    });
    function createTestManager() {
        testManager = new nose.TestManager(rootDirectory, outChannel);
    }
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: nose.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;

    test('Discover Tests (pattern = test_)', done => {
        pythonSettings.unitTest.nosetestArgs = [

        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 4, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 17, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 4, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_two.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_another_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            done();
        }).catch(done);
    });

    test('Discover Tests (pattern = test_)', done => {
        pythonSettings.unitTest.nosetestArgs = [
            '-m=*test*'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 4, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 13, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 3, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_one.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_unittest_two.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'tests/test_another_pytest.py' && t.nameToRun === t.name), true, 'Test File not found');
            done();
        }).catch(done);
    });

    test('Run Tests', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 5, 'Errors');
            assert.equal(results.summary.failures, 5, 'Failures');
            assert.equal(results.summary.passed, 7, 'Passed');
            assert.equal(results.summary.skipped, 2, 'skipped');
            done();
        }).catch(done);
    });

    test('Run Failed Tests', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 5, 'Errors');
            assert.equal(results.summary.failures, 5, 'Failures');
            assert.equal(results.summary.passed, 7, 'Passed');
            assert.equal(results.summary.skipped, 2, 'skipped');

            return testManager.runTest(true).then(tests => {
                assert.equal(results.summary.errors, 5, 'Errors');
                assert.equal(results.summary.failures, 5, 'Failures');
                assert.equal(results.summary.passed, 0, 'Passed');
                assert.equal(results.summary.skipped, 0, 'skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test File', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFile: TestsToRun = { testFile: [tests.testFiles[0]], testFolder: [], testFunction: [], testSuite: [] };
            return testManager.runTest(testFile).then(tests => {
                assert.equal(tests.summary.errors, 2, 'Errors');
                assert.equal(tests.summary.failures, 0, 'Failures');
                assert.equal(tests.summary.passed, 0, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test Suite', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuits[0].testSuite] };
            return testManager.runTest(testSuite).then(tests => {
                assert.equal(tests.summary.errors, 1, 'Errors');
                assert.equal(tests.summary.failures, 0, 'Failures');
                assert.equal(tests.summary.passed, 0, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test Function', done => {
        pythonSettings.unitTest.nosetestArgs = [
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
            return testManager.runTest(testFn).then(tests => {
                assert.equal(tests.summary.errors, 1, 'Errors');
                assert.equal(tests.summary.failures, 0, 'Failures');
                assert.equal(tests.summary.passed, 0, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
                done();
            });
        }).catch(done);
    });
});