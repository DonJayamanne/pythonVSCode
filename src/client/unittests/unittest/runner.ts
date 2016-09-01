/// <reference path="../../../../typings/globals/xml2js/index.d.ts" />

'use strict';
import * as path from 'path';
import {execPythonFile} from './../../common/utils';
import {createDeferred, createTemporaryFile} from '../../common/helpers';
import {TestFile, TestsToRun, TestSuite, TestFunction, FlattenedTestFunction, Tests, TestStatus, FlattenedTestSuite} from '../common/contracts';
import {extractBetweenDelimiters, flattenTestFiles, updateResults, convertFileToPackage} from '../common/testUtils';
import {BaseTestManager} from '../common/baseTestManager';
import {CancellationToken, OutputChannel} from 'vscode';
import {run} from '../common/runner';
import {Server} from './socketServer';
import {PythonSettings} from '../../common/configSettings';

const settings = PythonSettings.getInstance();
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
interface TestStatusMap {
    status: TestStatus;
    summaryProperty: string;
}

const outcomeMapping = new Map<string, TestStatusMap>();
outcomeMapping.set('passed', { status: TestStatus.Pass, summaryProperty: 'passed' });
outcomeMapping.set('failed', { status: TestStatus.Fail, summaryProperty: 'failures' });
outcomeMapping.set('error', { status: TestStatus.Error, summaryProperty: 'errors' });
outcomeMapping.set('skipped', { status: TestStatus.Skipped, summaryProperty: 'skipped' });
=======
const outcomeMapping = new Map<string, TestStatus>();
outcomeMapping.set('passed', TestStatus.Pass);
outcomeMapping.set('failed', TestStatus.Fail);
outcomeMapping.set('skipped', TestStatus.Skipped);
outcomeMapping.set('error', TestStatus.Error);
>>>>>>> unitests using python unittest framework #239

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
}
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764

export function runTest(rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel): Promise<Tests> {
    tests.summary.errors = 0;
    tests.summary.failures = 0;
    tests.summary.passed = 0;
    tests.summary.skipped = 0;

    const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
    const server = new Server();
    server.on('error', (message: string, ...data: string[]) => {
        console.log(`${message} ${data.join(' ')}`);
    });
    server.on('log', (message: string, ...data: string[]) => {
    });
    server.on('connect', (data) => {
    });
    server.on('start', (data: { test: string }) => {
    });
    server.on('result', (data: ITestData) => {
        const test = tests.testFunctions.find(t => t.testFunction.nameToRun === data.test);
        if (test) {
            const statusDetails = outcomeMapping.get(data.outcome);
            test.testFunction.status = statusDetails.status;
            test.testFunction.message = data.message;
            test.testFunction.traceback = data.traceback;
            tests.summary[statusDetails.summaryProperty] += 1;
        }
    });
    server.on('socket.disconnected', (data) => {
    });

    return server.start().then(port => {
        let testPaths: string[] = getIdsOfTestsToRun(tests, testsToRun);
        for (let counter = 0; counter < testPaths.length; counter++) {
            testPaths[counter] = '-t' + testPaths[counter].trim();
        }
        let testArgs = buildTestArgs(args);
        testArgs = [testLauncherFile].concat(testArgs).concat(`--result-port=${port}`).concat(testPaths);
        return run(settings.pythonPath, testArgs, rootDirectory, token, outChannel);
    }).then(() => {
        updateResults(tests);
        return tests;
    });
}

function buildTestArgs(args: string[]): string[] {
    let startDirectory = '.';
    let pattern = 'test*.py';
    const indexOfStartDir = args.findIndex(arg => arg.indexOf('-s') === 0 || arg.indexOf('--start-directory') === 0);
    if (indexOfStartDir >= 0) {
        const startDir = args[indexOfStartDir].trim();
        if ((startDir.trim() === '-s' || startDir.trim() === '--start-directory') && args.length >= indexOfStartDir) {
=======
const summary = {
    passed: 0,
    failed: 0,
    error: 0,
    skipped: 0
};

export function runTest(rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel): Promise<Tests> {
    let startDirectory = '.';
    let pattern = 'test*.py';
    const indexOfStartDir = args.findIndex(arg => arg.indexOf('-s') === 0);
    if (indexOfStartDir > 0) {
        const startDir = args[indexOfStartDir].trim();
        if (startDir.trim() === '-s' && args.length >= indexOfStartDir) {
>>>>>>> unitests using python unittest framework #239
            // Assume the next items is the directory
            startDirectory = args[indexOfStartDir + 1];
        }
        else {
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
            const lenToStartFrom = startDir.startsWith('-s') ? '-s'.length : '--start-directory'.length;
            startDirectory = startDir.substring(lenToStartFrom).trim();
=======
            startDirectory = startDir.substring(2).trim();
>>>>>>> unitests using python unittest framework #239
            if (startDirectory.startsWith('=')) {
                startDirectory = startDirectory.substring(1);
            }
        }
    }
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
    const indexOfPattern = args.findIndex(arg => arg.indexOf('-p') === 0 || arg.indexOf('--pattern') === 0);
    if (indexOfPattern >= 0) {
        const patternValue = args[indexOfPattern].trim();
        if ((patternValue.trim() === '-p' || patternValue.trim() === '--pattern') && args.length >= indexOfPattern) {
=======
    const indexOfPattern = args.findIndex(arg => arg.indexOf('-p') === 0);
    if (indexOfPattern > 0) {
        const patternValue = args[indexOfPattern].trim();
        if (patternValue.trim() === '-s' && args.length >= indexOfPattern) {
>>>>>>> unitests using python unittest framework #239
            // Assume the next items is the directory
            pattern = args[indexOfPattern + 1];
        }
        else {
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
            const lenToStartFrom = patternValue.startsWith('-p') ? '-p'.length : '--pattern'.length;
            pattern = patternValue.substring(lenToStartFrom).trim();
=======
            pattern = patternValue.substring(2).trim();
>>>>>>> unitests using python unittest framework #239
            if (pattern.startsWith('=')) {
                pattern = pattern.substring(1);
            }
        }
    }
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
    const failFast = args.some(arg => arg.trim() === '-f' || arg.trim() === '--failfast');
    const verbosity = args.some(arg => arg.trim().indexOf('-v') === 0) ? 2 : 1;
    const testArgs = [`--us=${startDirectory}`, `--up=${pattern}`, `--uvInt=${verbosity}`];
    if (failFast) {
        testArgs.push('--uf');
    }
    return testArgs;
}
function getIdsOfTestsToRun(tests: Tests, testsToRun: TestsToRun): string[] {
    const testIds = [];
=======
    args = [`--us=${startDirectory}`, `--up=${pattern}`];

    summary.error = 0;
    summary.failed = 0;
    summary.skipped = 0;
    summary.passed = 0;
    let testPaths: string[] = [];
>>>>>>> unitests using python unittest framework #239
    if (testsToRun && testsToRun.testFolder) {
        // Get test ids of files in these folders
        testsToRun.testFolder.map(folder => {
            tests.testFiles.forEach(f => {
                if (f.fullPath.startsWith(folder.name)) {
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
                    testIds.push(f.nameToRun);
=======
                    testPaths.push(f.nameToRun);
>>>>>>> unitests using python unittest framework #239
                }
            });
        });
    }
    if (testsToRun && testsToRun.testFile) {
<<<<<<< a3034a0dafa547afd949f2b0dcbdcba6accb5764
        testIds.push(...testsToRun.testFile.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testSuite) {
        testIds.push(...testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFunction) {
        testIds.push(...testsToRun.testFunction.map(f => f.nameToRun));
    }
    return testIds;
=======
        testPaths = testPaths.concat(testsToRun.testFile.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testSuite) {
        testPaths = testPaths.concat(testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFunction) {
        testPaths = testPaths.concat(testsToRun.testFunction.map(f => f.nameToRun));
    }
    for (let counter = 0; counter < testPaths.length; counter++) {
        testPaths[counter] = '-t ' + testPaths[counter].trim();
    }
    const testLauncherFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'visualstudio_py_testlauncher.py');
    const server = new Server();
    server.on('error', (message: string, ...data: string[]) => {
        console.log(`${message} ${data.join(' ')}`);
    });
    server.on('log', (message: string, ...data: string[]) => {
    });
    server.on('connect', (data) => {
    });
    server.on('start', (data) => {
    });
    server.on('result', (data: ITestData) => {
        const test = tests.testFunctions.find(t => t.testFunction.nameToRun === data.test);
        if (test) {
            test.testFunction.status = outcomeMapping.get(data.outcome);
            test.testFunction.message = data.message;
            test.testFunction.traceback = data.traceback;

            switch (test.testFunction.status) {
                case TestStatus.Pass: {
                    summary.passed += 1;
                    break;
                }
                case TestStatus.Fail: {
                    summary.failed += 1;
                    break;
                }
                case TestStatus.Error: {
                    summary.error += 1;
                    break;
                }
                case TestStatus.Skipped: {
                    summary.skipped += 1;
                    break;
                }
            }
        }
    });
    server.on('socket.disconnected', (data) => {
    });

    return server.start().then(port => {
        return run(settings.pythonPath, [testLauncherFile].concat(args).concat(`--result-port=${port}`).concat(testPaths), rootDirectory, token, outChannel);
    }).then(() => {
        tests.summary.errors = summary.error;
        tests.summary.failures = summary.failed;
        tests.summary.passed = summary.passed;
        tests.summary.skipped = summary.skipped;
        updateResults(tests);
        return tests;
    });
>>>>>>> unitests using python unittest framework #239
}