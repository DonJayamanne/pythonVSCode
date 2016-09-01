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
const outcomeMapping = new Map<string, TestStatus>();
outcomeMapping.set('passed', TestStatus.Pass);
outcomeMapping.set('failed', TestStatus.Fail);
outcomeMapping.set('skipped', TestStatus.Skipped);
outcomeMapping.set('error', TestStatus.Error);

interface ITestData {
    test: string;
    message: string;
    outcome: string;
    traceback: string;
}
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
            // Assume the next items is the directory
            startDirectory = args[indexOfStartDir + 1];
        }
        else {
            startDirectory = startDir.substring(2).trim();
            if (startDirectory.startsWith('=')) {
                startDirectory = startDirectory.substring(1);
            }
        }
    }
    const indexOfPattern = args.findIndex(arg => arg.indexOf('-p') === 0);
    if (indexOfPattern > 0) {
        const patternValue = args[indexOfPattern].trim();
        if (patternValue.trim() === '-s' && args.length >= indexOfPattern) {
            // Assume the next items is the directory
            pattern = args[indexOfPattern + 1];
        }
        else {
            pattern = patternValue.substring(2).trim();
            if (pattern.startsWith('=')) {
                pattern = pattern.substring(1);
            }
        }
    }
    args = [`--us=${startDirectory}`, `--up=${pattern}`];

    summary.error = 0;
    summary.failed = 0;
    summary.skipped = 0;
    summary.passed = 0;
    let testPaths: string[] = [];
    if (testsToRun && testsToRun.testFolder) {
        // Get test ids of files in these folders
        testsToRun.testFolder.map(folder => {
            tests.testFiles.forEach(f => {
                if (f.fullPath.startsWith(folder.name)) {
                    testPaths.push(f.nameToRun);
                }
            });
        });
    }
    if (testsToRun && testsToRun.testFile) {
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
}