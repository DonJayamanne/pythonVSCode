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
import * as unittest from '../client/unittests/unittest/main';
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

suite('Unit Tests (unittest)', () => {
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
        testManager = new unittest.TestManager(rootDirectory, outChannel);
    }
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: unittest.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;

    test('Discover Tests', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_*.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 3, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
            assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_two.py' && t.nameToRun === 'Test_test2.test_A2'), true, 'Test File not found');
            done();
        }).catch(done);
    });

    test('Discover Tests (pattern = *_test_*.py)', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*_test*.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
            assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
            assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
            assert.equal(tests.testFiles.some(t => t.name === 'unittest_three_test.py' && t.nameToRun === 'Test_test3.test_A'), true, 'Test File not found');
            done();
        }).catch(done);
    });

    test('Run Tests', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*test*.py'
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 1, 'Errors');
            assert.equal(results.summary.failures, 5, 'Failures');
            assert.equal(results.summary.passed, 4, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');
            done();
        }).catch(done);
    });

    // test('Fail Fast', done => {
    //     pythonSettings.unitTest.unittestArgs = [
    //         '-s=./tests',
    //         '-p=*test*.py',
    //         '--failfast'
    //     ];
    //     createTestManager();
    //     testManager.runTest().then(results => {
    //         assert.equal(results.summary.errors, 1, 'Errors');
    //         assert.equal(results.summary.failures, 5, 'Failures');
    //         assert.equal(results.summary.passed, 4, 'Passed');
    //         assert.equal(results.summary.skipped, 1, 'skipped');
    //         done();
    //     }).catch(done);
    // });

    test('Run Failed Tests', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*test*.py'
        ];
        createTestManager();
        testManager.runTest().then(results => {
            assert.equal(results.summary.errors, 1, 'Errors');
            assert.equal(results.summary.failures, 5, 'Failures');
            assert.equal(results.summary.passed, 4, 'Passed');
            assert.equal(results.summary.skipped, 1, 'skipped');

            return testManager.runTest(true).then(tests => {
                assert.equal(results.summary.errors, 1, 'Failed Errors');
                assert.equal(results.summary.failures, 5, 'Failed Failures');
                assert.equal(results.summary.passed, 0, 'Failed Passed');
                assert.equal(results.summary.skipped, 0, 'Failed skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test File', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*test*.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFile: TestsToRun = { testFile: [tests.testFiles[0]], testFolder: [], testFunction: [], testSuite: [] };
            return testManager.runTest(testFile).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 1, 'Passed');
                assert.equal(tests.summary.skipped, 1, 'skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test Suite', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*test*.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuits[0].testSuite] };
            return testManager.runTest(testSuite).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 1, 'Passed');
                assert.equal(tests.summary.skipped, 1, 'skipped');
                done();
            });
        }).catch(done);
    });

    test('Run Specific Test Function', done => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*test*.py'
        ];
        createTestManager();
        testManager.discoverTests(true, true).then(tests => {
            const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
            return testManager.runTest(testFn).then(tests => {
                assert.equal(tests.summary.errors, 0, 'Errors');
                assert.equal(tests.summary.failures, 1, 'Failures');
                assert.equal(tests.summary.passed, 0, 'Passed');
                assert.equal(tests.summary.skipped, 0, 'skipped');
                done();
            });
        }).catch(done);
    });
});