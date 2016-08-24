import * as fs from 'fs';
import * as xml2js from 'xml2js';
import {TestFile, TestsToRun, TestSuite, TestFunction, FlattenedTestFunction, Tests, TestStatus, FlattenedTestSuite} from './contracts';

export enum PassCalculationFormulae {
    pytest,
    nosetests
}
interface TestSuiteResult {
    $: {
        errors: string;
        failures: string;
        name: string;
        skips: string;
        skip: string;
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
        $: { message: string, type: string }
    }[];
    error: {
        _: string;
        $: { message: string, type: string }
    }[];
    skipped: {
        _: string;
        $: { message: string, type: string }
    }[];
}

function getSafeInt(value: string, defaultValue: any = 0): number {
    const num = parseInt(value);
    if (isNaN(num)) { return defaultValue; }
    return num;
}
export function updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string, passCalculationFormulae: PassCalculationFormulae): Promise<any> {
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
                tests.summary.errors = getSafeInt(testSuiteResult.$.errors);
                tests.summary.failures = getSafeInt(testSuiteResult.$.failures);
                tests.summary.skipped = getSafeInt(testSuiteResult.$.skips ? testSuiteResult.$.skips : testSuiteResult.$.skip);
                let testCount = getSafeInt(testSuiteResult.$.tests);

                switch (passCalculationFormulae) {
                    case PassCalculationFormulae.pytest: {
                        tests.summary.passed = testCount - tests.summary.failures - tests.summary.skipped;
                        break;
                    }
                    case PassCalculationFormulae.nosetests: {
                        tests.summary.passed = testCount - tests.summary.failures - tests.summary.skipped - tests.summary.errors;
                        break;
                    }
                    default: {
                        throw new Error("Unknown UnitTest Pass Calculation");
                    }
                }

                if (!Array.isArray(testSuiteResult.testcase)) {
                    return resolve();
                }

                testSuiteResult.testcase.forEach((testcase: TestCaseResult) => {
                    const xmlClassName = testcase.$.classname.replace(/\(\)/g, '').replace(/\.\./g, '.').replace(/\.\./g, '.').replace(/\.+$/, '');
                    let result = tests.testFunctions.find(fn => fn.xmlClassName === xmlClassName && fn.testFunction.name === testcase.$.name);
                    if (!result) {
                        // oops
                        // Look for failed file test
                        let fileTest = testcase.$.file && tests.testFiles.find(file => file.rawName === testcase.$.file);
                        if (fileTest && testcase.error) {
                            fileTest.status = TestStatus.Error;
                            fileTest.passed = false;
                            fileTest.message = testcase.error[0].$.message;
                            fileTest.traceback = testcase.error[0]._;
                        }
                        return;
                    }

                    result.testFunction.line = getSafeInt(testcase.$.line, null);
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

                    if (testcase.skipped) {
                        result.testFunction.status = TestStatus.Skipped;
                        result.testFunction.passed = null;
                        result.testFunction.message = testcase.skipped[0].$.message;
                        result.testFunction.traceback = '';
                    }
                });

                resolve();
            });
        });
    });
}
