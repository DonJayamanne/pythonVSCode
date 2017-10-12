import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as nose from '../../client/unittests/nosetest/main';
import { rootWorkspaceUri, updateSetting } from '../common';
import { initialize, initializeTest, IS_MULTI_ROOT_TEST } from './../initialize';
import { TestsToRun } from '../../client/unittests/common/contracts';
import { TestResultDisplay } from '../../client/unittests/display/main';
import { MockOutputChannel } from './../mockClasses';

const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const filesToDelete = [path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'standard', '.noseids'),
path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src', '.noseids')];
const unitTestTestFilesCwdPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');

suite('Unit Tests (nosetest)', () => {
    const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
    suiteSetup(async () => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
        await updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
        await initialize();
    });
    suiteTeardown(() => {
        filesToDelete.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    });
    setup(async () => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
        await initializeTest();
    });
    teardown(() => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
        return updateSetting('unitTest.nosetestArgs', [], rootWorkspaceUri, configTarget);
    });
    function createTestManager(rootDir: string = rootDirectory) {
        testManager = new nose.TestManager(rootDir, outChannel);
    }
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: nose.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: vscode.OutputChannel;

    test('Discover Tests (single test file)', async () => {
        testManager = new nose.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel);
        const tests = await testManager.discoverTests(true, true)
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_one.py') && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Check that nameToRun in testSuits has class name after : (single test file)', async () => {
        testManager = new nose.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel);
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 6, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 2, 'Incorrect number of test suites');
        assert.equal(tests.testSuits.every(t => t.testSuite.name === t.testSuite.nameToRun.split(":")[1]), true, 'Suite name does not match class name');
    });

    test('Discover Tests (pattern = test_)', async () => {
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 6, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 22, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 6, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_unittest_one.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_unittest_two.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_pytest.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_another_pytest.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'unittest_three_test.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Discover Tests (pattern = _test_)', async () => {
        await updateSetting('unitTest.nosetestArgs', ['-m=*test*'], rootWorkspaceUri, configTarget);
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 6, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 18, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 5, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_unittest_one.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_unittest_two.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_pytest.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'test_another_pytest.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === path.join('tests', 'unittest_three_test.py') && t.nameToRun === t.name), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_root.py' && t.nameToRun === t.name), true, 'Test File not found');
    });

    test('Run Tests', async () => {
        createTestManager();
        const results = await testManager.runTest();
        assert.equal(results.summary.errors, 5, 'Errors');
        assert.equal(results.summary.failures, 6, 'Failures');
        assert.equal(results.summary.passed, 8, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');
    });

    test('Run Failed Tests', async () => {
        createTestManager();
        let results = await testManager.runTest();
        assert.equal(results.summary.errors, 5, 'Errors');
        assert.equal(results.summary.failures, 6, 'Failures');
        assert.equal(results.summary.passed, 8, 'Passed');
        assert.equal(results.summary.skipped, 3, 'skipped');

        results = await testManager.runTest(true);
        assert.equal(results.summary.errors, 5, 'Errors again');
        assert.equal(results.summary.failures, 6, 'Failures again');
        assert.equal(results.summary.passed, 0, 'Passed again');
        assert.equal(results.summary.skipped, 0, 'skipped again');
    });

    test('Run Specific Test File', async () => {
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testFile: TestsToRun = { testFile: [tests.testFiles[0]], testFolder: [], testFunction: [], testSuite: [] };
        const results = await testManager.runTest(testFile);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Suite', async () => {
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuits[0].testSuite] };
        const results = await testManager.runTest(testSuite);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
    });

    test('Run Specific Test Function', async () => {
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testFn: TestsToRun = { testFile: [], testFolder: [], testFunction: [tests.testFunctions[0].testFunction], testSuite: [] };
        const results = await testManager.runTest(testFn);
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 0, 'Passed');
        assert.equal(results.summary.skipped, 0, 'skipped');
    });

    test('Setting cwd should return tests', async () => {
        await updateSetting('unitTest.nosetestArgs', ['tests'], rootWorkspaceUri, configTarget);
        createTestManager(unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
    });
});
