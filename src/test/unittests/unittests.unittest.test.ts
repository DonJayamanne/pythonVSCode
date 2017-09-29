import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as configSettings from '../../client/common/configSettings';
import * as unittest from '../../client/unittests/unittest/main';
import { initialize } from './../initialize';
import { TestsToRun, TestStatus } from '../../client/unittests/common/contracts';
import { TestResultDisplay } from '../../client/unittests/display/main';
import { MockOutputChannel } from './../mockClasses';

const pythonSettings = configSettings.PythonSettings.getInstance();
const UNITTEST_TEST_FILES_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'standard');
const UNITTEST_SINGLE_TEST_FILE_PATH = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'single');
const unitTestTestFilesCwdPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'testFiles', 'cwd', 'src');

suite('Unit Tests (unittest)', () => {
    suiteSetup(() => initialize());
    setup(() => {
        outChannel = new MockOutputChannel('Python Test Log');
        testResultDisplay = new TestResultDisplay(outChannel);
    });
    teardown(() => {
        outChannel.dispose();
        testManager.dispose();
        testResultDisplay.dispose();
    });
    function createTestManager(rootDir: string = rootDirectory) {
        testManager = new unittest.TestManager(rootDir, outChannel);
    }
    const rootDirectory = UNITTEST_TEST_FILES_PATH;
    let testManager: unittest.TestManager;
    let testResultDisplay: TestResultDisplay;
    let outChannel: MockOutputChannel;

    test('Discover Tests (single test file)', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_*.py'
        ];
        testManager = new unittest.TestManager(UNITTEST_SINGLE_TEST_FILE_PATH, outChannel);
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 3, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
    });

    test('Discover Tests', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_*.py'
        ];
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 2, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 9, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 3, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_one.py' && t.nameToRun === 'Test_test1.test_A'), true, 'Test File not found');
        assert.equal(tests.testFiles.some(t => t.name === 'test_unittest_two.py' && t.nameToRun === 'Test_test2.test_A2'), true, 'Test File not found');
    });

    test('Discover Tests (pattern = *_test_*.py)', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=*_test*.py'
        ];
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFunctions.length, 2, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
        assert.equal(tests.testFiles.some(t => t.name === 'unittest_three_test.py' && t.nameToRun === 'Test_test3.test_A'), true, 'Test File not found');
    });

    test('Run Tests', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-v', '-s', './tests',
            '-p', 'test_unittest*.py'
        ];
        createTestManager();
        const results = await testManager.runTest();
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
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

    test('Run Failed Tests', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_unittest*.py'
        ];
        createTestManager();
        let results = await testManager.runTest();
        assert.equal(results.summary.errors, 1, 'Errors');
        assert.equal(results.summary.failures, 4, 'Failures');
        assert.equal(results.summary.passed, 3, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');

        results = await testManager.runTest(true);
        assert.equal(results.summary.errors, 1, 'Failed Errors');
        assert.equal(results.summary.failures, 4, 'Failed Failures');
        assert.equal(results.summary.passed, 0, 'Failed Passed');
        assert.equal(results.summary.skipped, 0, 'Failed skipped');
    });

    test('Run Specific Test File', async () => {
        console.log('Start');
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_unittest*.py'
        ];
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testFile: TestsToRun = { testFile: [tests.testFiles[0]], testFolder: [], testFunction: [], testSuite: [] };
        console.log(tests.testFiles[0].fullPath);
        console.log(tests.testFiles[0].name);
        console.log(tests.testFiles[0].nameToRun);
        const results = await testManager.runTest(testFile);
        console.log(outChannel.output);
        console.log('Identify failed tests');
        const failed = tests.testFunctions.filter(f => f.testFunction.status === TestStatus.Error || f.testFunction.status === TestStatus.Fail);
        failed.forEach(f => {
            console.log('start error function');
            console.log(`Message = ${f.testFunction.message}`);
            console.log(`Name = ${f.testFunction.name}`);
            console.log(`NameToRun = ${f.testFunction.nameToRun}`);
            console.log(`Traceback = ${f.testFunction.traceback}`);
            if (f.parentTestFile) {
                console.log(`Message = ${f.parentTestFile.fullPath}`);
            }
        });

        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
        console.log('End');
    });

    test('Run Specific Test Suite', async () => {
        console.log('Start');
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_unittest*.py'
        ];
        createTestManager();
        const tests = await testManager.discoverTests(true, true);
        const testSuite: TestsToRun = { testFile: [], testFolder: [], testFunction: [], testSuite: [tests.testSuits[0].testSuite] };
        console.log(tests.testSuits[0].testSuite.name);
        console.log(tests.testSuits[0].testSuite.name);
        console.log(tests.testSuits[0].testSuite.name);
        console.log(tests.testSuits[0].testSuite.name);
        const results = await testManager.runTest(testSuite);
        console.log(outChannel.output);
        console.log(results);
        console.log('Identify failed tests');
        const failed = tests.testFunctions.filter(f => f.testFunction.status === TestStatus.Error || f.testFunction.status === TestStatus.Fail);
        failed.forEach(f => {
            console.log('start error function');
            console.log(`Message = ${f.testFunction.message}`);
            console.log(`Name = ${f.testFunction.name}`);
            console.log(`NameToRun = ${f.testFunction.nameToRun}`);
            console.log(`Traceback = ${f.testFunction.traceback}`);
            if (f.parentTestFile) {
                console.log(`Message = ${f.parentTestFile.fullPath}`);
            }
        });
        assert.equal(results.summary.errors, 0, 'Errors');
        assert.equal(results.summary.failures, 1, 'Failures');
        assert.equal(results.summary.passed, 1, 'Passed');
        assert.equal(results.summary.skipped, 1, 'skipped');
        console.log('End');
    });

    test('Run Specific Test Function', async () => {
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_unittest*.py'
        ];
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
        pythonSettings.unitTest.unittestArgs = [
            '-s=./tests',
            '-p=test_*.py'
        ];
        createTestManager(unitTestTestFilesCwdPath);

        const tests = await testManager.discoverTests(true, true);
        assert.equal(tests.testFiles.length, 1, 'Incorrect number of test files');
        assert.equal(tests.testFolders.length, 1, 'Incorrect number of test folders');
        assert.equal(tests.testFunctions.length, 1, 'Incorrect number of test functions');
        assert.equal(tests.testSuits.length, 1, 'Incorrect number of test suites');
    });
}); 
