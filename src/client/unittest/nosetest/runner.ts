'use strict';
import * as path from 'path';
import {execPythonFile} from './../../common/utils';
import {createDeferred, createTemporaryFile} from '../../common/helpers';
import {OutputChannel, window} from 'vscode';
import {TestFile, TestsToRun, TestSuite, TestFunction, FlattenedTestFunction, Tests, TestStatus, FlattenedTestSuite} from '../contracts';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as os from 'os';
import * as vscode from 'vscode';
import {extractBetweenDelimiters, convertFileToPackage, flattenTestFiles, updateResults, BaseTestManager} from '../testUtils';

interface TestCaseResult {
    $: {
        classname: string;
        file: string;
        line: string;
        name: string;
        time: string;
    };
    failure: {
        _: string;
        $: { message: string }
    }[];
}

export function runTest(rootDirectory: string, tests: Tests, testsToRun?: TestsToRun, stdOut?: (output: string) => void): Promise<any> {
    let testPaths = [];
    if (testsToRun && testsToRun.testFolder) {
        testPaths = testPaths.concat(testsToRun.testFolder.map(f => f.rawName));
    }
    if (testsToRun && testsToRun.testFile) {
        testPaths = testPaths.concat(testsToRun.testFile.map(f => f.rawName));
    }
    if (testsToRun && testsToRun.testSuite) {
        testPaths = testPaths.concat(testsToRun.testSuite.map(f => f.rawName));
    }
    if (testsToRun && testsToRun.testFunction) {
        testPaths = testPaths.concat(testsToRun.testFunction.map(f => f.rawName));
    }

    let xmlLogFile = '';
    let xmlLogFileCleanup: Function = null;
    let rawLogFile = '';
    let rawLogFileCleanup: Function = null;

    return createTemporaryFile('.xml').then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;
        return createTemporaryFile('.log');
    }).then(rawLowResult => {
        rawLogFile = rawLowResult.filePath;
        rawLogFileCleanup = rawLowResult.cleanupCallback;
        return execPythonFile('nosetests', ['--with-xunit', `--xunit-file=${xmlLogFile}`].concat(testPaths), rootDirectory, true, stdOut);
    }).then(() => {
        return updateResultsFromLogFiles(tests, xmlLogFile, rawLogFile);
    }).then(result => {
        xmlLogFileCleanup();
        rawLogFileCleanup();
        return result;
    }).catch(reason => {
        xmlLogFileCleanup();
        rawLogFileCleanup();
        return Promise.reject(reason);
    });
}

export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string, outputRawFile: string): Promise<any> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile).then(() => {
        return updateResultsFromRawLogFile(tests, outputRawFile);
    }).then(() => {
        updateResults(tests);
        return tests;
    });
}

function updateTestTestFileSuiteWithResult(tests: Tests, rawTestName: string, pass?: boolean, tracebackLines?: string[], errorMessage?: string) {
    let testFileSuite: TestFile | TestSuite;
    testFileSuite = tests.testFiles.find(f => f.rawName === rawTestName);
    if (!testFileSuite) {
        let suite = tests.testSuits.find(suite => suite.testSuite.rawName === rawTestName);
        if (suite) {
            testFileSuite = suite.testSuite;
        }
    }
    if (!testFileSuite) {
        let files = tests.testFiles.filter(f => f.rawName.endsWith(rawTestName));
        if (files.length === 1) {
            testFileSuite = files[0];
        }
        if (!testFileSuite) {
            let suites = tests.testSuits.filter(suite => suite.testSuite.rawName.endsWith(rawTestName));
            if (suites.length === 1) {
                testFileSuite = suites[0].testSuite;
            }
        }
    }
    if (!testFileSuite) {
        return;
    }
    if (typeof pass === 'boolean') {
        testFileSuite.passed = pass;
        testFileSuite.status = pass ? TestStatus.Idle : TestStatus.Fail;
    }
    if (tracebackLines && tracebackLines.length > 0) {
        testFileSuite.traceback = tracebackLines.join('\r\n');
    }
    if (errorMessage && errorMessage.length > 0) {
        testFileSuite.message = errorMessage;
    }
}

function updateTestFunctionWithResult(tests: Tests, rawTestMethodName: string, pass?: boolean, tracebackLines?: string[], errorMessage?: string) {
    let fn = tests.testFunctions.find(fn => fn.testFunction.rawName === rawTestMethodName);
    if (!fn) {
        // Possible rawtestMethodName is a test file or a test suite
        updateTestTestFileSuiteWithResult(tests, rawTestMethodName, pass, tracebackLines, errorMessage);
        return;
    }
    const testFunction = fn.testFunction;
    if (typeof pass === 'boolean') {
        testFunction.passed = pass;
        testFunction.status = pass ? TestStatus.Idle : TestStatus.Fail;
    }
    if (tracebackLines && tracebackLines.length > 0) {
        testFunction.traceback = tracebackLines.join('\r\n');
    }
    if (errorMessage && errorMessage.length > 0) {
        testFunction.message = errorMessage;
    }
}

function updateResultsFromRawLogFile(tests: Tests, outputRawFile: string): Promise<any> {
    let deferred = createDeferred<any>();
    fs.readFile(outputRawFile, 'utf8', (err, data) => {
        if (err) {
            return deferred.reject(err);
        }

        let isSuccess = true;
        let lastTestFunction: FlattenedTestFunction;
        let lastRawTestMethodName = '';
        let errorLines: string[] = [];
        const lines = data.split(/\r?\n/g);
        let errorMessage: string = '';

        lines.forEach(line => {
            if (line.startsWith('.')) {
                if (lastRawTestMethodName.length > 0) {
                    updateTestFunctionWithResult(tests, lastRawTestMethodName, null, errorLines, errorMessage);
                }
                lastRawTestMethodName = line.substring(1).trim();
                updateTestFunctionWithResult(tests, lastRawTestMethodName, true);

                lastRawTestMethodName = '';
                errorLines = [];
                errorMessage = '';
                return;
            }
            if (line.startsWith('F')) {
                if (lastRawTestMethodName.length > 0) {
                    updateTestFunctionWithResult(tests, lastRawTestMethodName, null, errorLines, errorMessage);

                    lastRawTestMethodName = '';
                }

                lastRawTestMethodName = line.substring(1).trim();
                updateTestFunctionWithResult(tests, lastRawTestMethodName, false);
                errorLines = [];
                errorMessage = '';
                return;
            }
            if (line.startsWith(' E')) {
                errorMessage = line.trim().substring(1);
                return;
            }

            errorLines.push(line);
        });

        if (lastRawTestMethodName.length > 0) {
            updateTestFunctionWithResult(tests, lastRawTestMethodName, null, errorLines, errorMessage);
        }

        deferred.resolve();
    });

    return deferred.promise;
}

function updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        fs.readFile(outputXmlFile, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            xml2js.parseString(data, (err, result) => {
                if (err) {
                    return reject(err);
                }

                (result.testsuite.testcase as TestCaseResult[]).forEach((testcase: TestCaseResult) => {
                    const xmlClassName = testcase.$.classname.replace(/\(\)/g, '').replace(/\.\./g, '.').replace(/\.\./g, '.').replace(/\.+$/, '');
                    let result = tests.testFunctions.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === testcase.$.name);
                    if (!result) {
                        // oops
                        return;
                    }

                    result.testFunction.line = parseInt(testcase.$.line);
                    result.testFunction.time = parseFloat(testcase.$.time);
                    result.testFunction.passed = true;
                    result.testFunction.status = TestStatus.Idle;

                    if (testcase.failure) {
                        result.testFunction.status = TestStatus.Error;
                        result.testFunction.passed = false;
                        result.testFunction.message = testcase.failure[0].$.message;
                        result.testFunction.traceback = testcase.failure[0]._;
                    }
                });

                resolve();
            });
        });
    });
}
