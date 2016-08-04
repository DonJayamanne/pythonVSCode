/// <reference path="../../../../typings/globals/xml2js/index.d.ts" />

'use strict';
import {execPythonFile} from './../../common/utils';
import {createDeferred, createTemporaryFile} from '../../common/helpers';
import {TestFile, TestsToRun, TestSuite, TestFunction, FlattenedTestFunction, Tests, TestStatus, FlattenedTestSuite} from '../contracts';
import * as fs from 'fs';
import * as xml2js from 'xml2js';
import {BaseTestManager, extractBetweenDelimiters, flattenTestFiles, updateResults, convertFileToPackage} from '../testUtils';
import {CancellationToken} from 'vscode';

interface TestSuiteResult {
    $: {
        errors: string;
        failures: string;
        name: string;
        skips: string;
        tests: string;
        time: string;
    };
    testcase: TestCaseResult[];
}
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
    error: {
        _: string;
        $: { message: string }
    }[];
}
export function runTest(rootDirectory: string, tests: Tests, testsToRun?: TestsToRun, stdOut?: (output: string) => void, args?: string[], token?: CancellationToken): Promise<Tests> {
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

    return createTemporaryFile('.xml').then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;
        const testArgs = args.concat([`--junitxml=${xmlLogFile}`]).concat(testPaths);
        return execPythonFile('py.test', testArgs, rootDirectory, true, stdOut, token);
    }).then(() => {
        return updateResultsFromLogFiles(tests, xmlLogFile);
    }).then(result => {
        xmlLogFileCleanup();
        return result;
    }).catch(reason => {
        xmlLogFileCleanup();
        return Promise.reject(reason);
    });
}

export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string): Promise<Tests> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile).then(() => {
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

function updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string): Promise<Tests> {
    return new Promise<any>((resolve, reject) => {
        fs.readFile(outputXmlFile, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            xml2js.parseString(data, (err, result) => {
                if (err) {
                    return reject(err);
                }
                let testSuiteResult: TestSuiteResult = result.testsuite;
                tests.summary.errors = parseInt(testSuiteResult.$.errors);
                tests.summary.failures = parseInt(testSuiteResult.$.failures);
                tests.summary.skipped = parseInt(testSuiteResult.$.skips);
                let testCount = parseInt(testSuiteResult.$.tests);
                tests.summary.passed = testCount - tests.summary.failures - tests.summary.skipped;

                if (!Array.isArray(testSuiteResult.testcase)) {
                    return resolve();
                }

                testSuiteResult.testcase.forEach((testcase: TestCaseResult) => {
                    const xmlClassName = testcase.$.classname.replace(/\(\)/g, '').replace(/\.\./g, '.').replace(/\.\./g, '.').replace(/\.+$/, '');
                    let result = tests.testFunctions.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === testcase.$.name);
                    if (!result) {
                        // oops
                        // Look for failed file test
                        let fileTest = tests.testFiles.find(file => file.rawName === testcase.$.file);
                        if (fileTest && testcase.error) {
                            fileTest.status = TestStatus.Error;
                            fileTest.passed = false;
                            fileTest.message = testcase.error[0].$.message;
                            fileTest.traceback = testcase.error[0]._;
                        }
                        return;
                    }

                    result.testFunction.line = parseInt(testcase.$.line);
                    result.testFunction.time = parseFloat(testcase.$.time);
                    result.testFunction.passed = true;
                    result.testFunction.status = TestStatus.Idle;

                    if (testcase.failure) {
                        result.testFunction.status = TestStatus.Fail;
                        result.testFunction.passed = false;
                        result.testFunction.message = testcase.failure[0].$.message;
                        result.testFunction.traceback = testcase.failure[0]._;
                    }

                    if (testcase.error) {
                        result.testFunction.status = TestStatus.Error;
                        result.testFunction.passed = false;
                        result.testFunction.message = testcase.error[0].$.message;
                        result.testFunction.traceback = testcase.error[0]._;
                    }
                });

                resolve();
            });
        });
    });
}
