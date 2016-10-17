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
import { TestStatus} from '../client/unittests/common/contracts';
import * as unittest from '../client/unittests/unittest/main';
import { TestResultDisplay } from '../client/unittests/display/main';

let unittestManager: unittest.TestManager;
let testResultDisplay: TestResultDisplay;
let outChannel: vscode.OutputChannel;

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

suiteSetup(done => {
    initialize().then(() => {
        done();
    });
});
suiteTeardown(done => {
    done();
});

suite('Unit Tests (unittest)', () => {
    // setup(() => {
    //     pythonSettings.unitTest.unittestEnabled = true;
    //     pythonSettings.unitTest.nosetestsEnabled = false;
    //     pythonSettings.unitTest.pyTestEnabled = false;
    //     outChannel = new MockOutputChannel('Python Test Log');
    // });

    test('Discover Tests', () => {
        const rootDirectory = UNITTEST_TEST_FILES_PATH;
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_*.py'
        ];
        const testManager = unittestManager ? unittestManager : new unittest.TestManager(rootDirectory, outChannel);
        if ((testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
            testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
            testManager.discoverTests(true, true).then(tests => {
                assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
                assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
                assert.equal(tests.testSuits.length, 3, 'Incorrect number of test suites');
                assert.equal(tests.testFiles.some(t=>t.name === 'test_unittest_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
                assert.equal(tests.testFiles.some(t=>t.name === 'test_unittest_two.py' && t.nameToRun === 'Test_test2.test_A2'), true, 'Test File not found');
            }).catch(reason => {
                assert.fail(reason, null, 'Test Discovery failed', '');
            });
        }
    });

    test('Discover Tests (pattern = *_test_*.py)', () => {
        const rootDirectory = UNITTEST_TEST_FILES_PATH;
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*_test*.py'
        ];
        const testManager = unittestManager ? unittestManager : new unittest.TestManager(rootDirectory, outChannel);
        if ((testManager.status !== TestStatus.Discovering && testManager.status !== TestStatus.Running)) {
            testResultDisplay = testResultDisplay ? testResultDisplay : new TestResultDisplay(outChannel);
            testManager.discoverTests(true, true).then(tests => {
                assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
                assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
                assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
                assert.equal(tests.testFiles.some(t=>t.name === 'unittest_three_test.py' && t.nameToRun === 'Test_test3.test_A'), true, 'Test File not found');
            }).catch(reason => {
                assert.fail(reason, null, 'Test Discovery failed', '');
            });
        }
    });
});