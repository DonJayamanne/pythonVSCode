/// <reference path="../../../typings/globals/xml2js/index.d.ts" />

'use strict';
import * as child_process from 'child_process';
import * as path from 'path';
import { exec } from 'child_process';
import {execPythonFile} from './../common/utils';
import {createDeferred} from './../common/helpers';
import * as settings from './../common/configSettings';
import {OutputChannel, window} from 'vscode';
import {TestFile, TestSuite, TestFunction, FlattenedTestFunction, Tests} from './contracts';
import * as fs from 'fs';
import * as xml2js from 'xml2js';

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
export function discoverTests(rootDirectory: string, testDirectory: string): Promise<Tests> {
    return execPythonFile('py.test', [testDirectory, '--collect-only'], rootDirectory, false)
        .then(output => parsePyTestCollectionResult(output))
        .then(testFiles => {
            let flattendFunctions = flattenTestFilesToTestFunctions(testFiles);
            return <Tests>{ testFiles: testFiles, testFunctions: flattendFunctions };
        });
}

export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string, outputRawFile: string): Promise<any> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile).then(() => {
        return updateResultsFromRawLogFile(tests, outputXmlFile);
    }).then(() => {
        updateResults(tests);
        return tests;
    });
}

function updateResults(tests: Tests) {
    tests.testFiles.forEach(updateResultsUpstream);
}

function updateResultsUpstream(test: TestSuite | TestFile) {
    let totalTime = 0;
    let passed = true;
    test.functions.forEach(fn => {
        totalTime += fn.time;
        if (!fn.passed) {
            passed = false;
        }
    });
    test.suites.forEach(suite => {
        updateResultsUpstream(suite);
        if (!suite.passed) {
            passed = false;
        }
        totalTime += suite.time;
    });

    test.passed = passed;
    test.time = totalTime;
}

function flattenTestFilesToTestFunctions(testFiles: TestFile[]): FlattenedTestFunction[] {
    let fns: FlattenedTestFunction[] = [];
    testFiles.forEach(testFile => {
        // sample test_three (file name without extension and all / replaced with ., meaning this is the package)
        const packageName = convertFileToPackage(testFile.name);

        testFile.functions.forEach(fn => {
            fns.push({ testFunction: fn, xmlClassName: packageName, parentTestFile: testFile });
        });

        testFile.suites.forEach(suite => {
            flattenTestSuitesToTestFunctions(fns, testFile, suite);
        });
    });
    return fns;
}
function flattenTestSuitesToTestFunctions(list: FlattenedTestFunction[], testFile: TestFile, testSuite: TestSuite) {
    let fns: FlattenedTestFunction[] = [];
    testSuite.functions.forEach(fn => {
        fns.push({ testFunction: fn, xmlClassName: testSuite.xmlName, parentTestFile: testFile, parentTestSuite: testSuite });
    });

    // We may have child classes
    testSuite.suites.forEach(suite => {
        flattenTestSuitesToTestFunctions(fns, testFile, suite);
    });
}

function updateResultsFromRawLogFile(tests: Tests, outputRawFile: string): Promise<any> {
    let deferred = createDeferred<any>();
    fs.readFile(outputRawFile, 'utf8', (err, data) => {
        if (err) {
            return deferred.reject(err);
        }

        let isSuccess = true;
        let lastTestFunction: FlattenedTestFunction;
        let errorLines: string[] = [];
        const lines = data.split(/\r?\n/g);
        lines.forEach(line => {
            if (line.startsWith('.')) {
                if (lastTestFunction && errorLines.length > 0) {
                    lastTestFunction.testFunction.traceback = errorLines.join('\r\n');
                }
                return;
            }
            if (line.startsWith('F')) {
                if (lastTestFunction && errorLines.length > 0) {
                    lastTestFunction.testFunction.traceback = errorLines.join('\r\n');
                }

                let rawTestMethodName = line.substring(1).trim();
                lastTestFunction = tests.testFunctions.find(fn => fn.testFunction.rawName === rawTestMethodName);
                errorLines = [];
                return;
            }

            errorLines.push(line);
        });

        if (lastTestFunction && errorLines.length > 0) {
            lastTestFunction.testFunction.traceback = errorLines.join('\r\n');
        }

        deferred.resolve();
    });

    return deferred.promise;
}

function updateResultsFromXmlLogFile(tests: Tests, outputXmlFile: string): Promise<any> {
    let deferred = createDeferred<any>();
    fs.readFile(outputXmlFile, 'utf8', (err, data) => {
        if (err) {
            return deferred.reject(err);
        }

        xml2js.parseString(data, (err, result) => {
            if (err) {
                return deferred.reject(err);
            }

            result.testsuite.testcase.foreach((testcase: TestCaseResult) => {
                let result = tests.testFunctions.find(fn => fn.xmlClassName === testcase.$.classname && fn.testFunction.name === testcase.$.name);
                if (!result) {
                    // oops
                    return;
                }

                result.testFunction.line = parseInt(testcase.$.line);
                result.testFunction.time = parseFloat(testcase.$.time);
                result.testFunction.passed = true;

                if (testcase.failure) {
                    result.testFunction.passed = false;
                    result.testFunction.message = testcase.failure[0].$.message;
                    result.testFunction.traceback = testcase.failure[0]._;
                }
            });

            deferred.resolve();
        });
    });

    return deferred.promise;
}

function convertFileToPackage(filePath: string): string {
    let lastIndex = filePath.lastIndexOf('.');
    return filePath.substring(0, lastIndex).replace(/\//g, '.').replace(/\\/g, '.');
}

const DELIMITER = '\'';
const DEFAULT_CLASS_INDENT = 2;

function parsePyTestCollectionResult(output: String): TestFile[] {
    let lines = output.split(/\r?\n/g);
    const startIndex = lines.findIndex(value => value.trim().startsWith('<Module \''));
    if (startIndex === -1) return [];
    lines = lines.slice(startIndex);

    const testFiles: TestFile[] = [];
    const parentNodes: { indent: number, item: TestFile | TestSuite }[] = [];
    let currentPackage: string = '';

    lines.forEach(line => {
        const trimmedLine = line.trim();
        const name = extractBetweenDelimiters(trimmedLine, DELIMITER, DELIMITER);
        const indent = line.indexOf('<');

        if (trimmedLine.startsWith('<Module \'')) {
            currentPackage = convertFileToPackage(name);
            const testFile = { functions: [], suites: [], name: name, rawName: name, xmlName: currentPackage };
            testFiles.push(testFile);
            parentNodes.push({ indent: indent, item: testFile });
            return;
        }

        const parentNode = findParentOfCurrentItem(indent, parentNodes);

        if (trimmedLine.startsWith('<Class \'') || trimmedLine.startsWith('<UnitTestCase \'')) {
            const isUnitTest = trimmedLine.startsWith('<UnitTestCase \'');
            const rawName = parentNode.item.rawName + `::${name}`;
            const xmlName = parentNode.item.xmlName + `.${name}`;
            const testSuite: TestSuite = { name: name, rawName: rawName, functions: [], suites: [], isUnitTest: isUnitTest, isInstance: false, xmlName: xmlName };
            parentNode.item.suites.push(testSuite);
            parentNodes.push({ indent: indent, item: testSuite });
            return;
        }
        if (trimmedLine.startsWith('<Instance \'')) {
            let suite = (parentNode.item as TestSuite);
            suite.rawName = suite.rawName + '::()';
            suite.xmlName = suite.xmlName + '.()';
            return;
        }
        if (trimmedLine.startsWith('<TestCaseFunction \'') || trimmedLine.startsWith('<Function \'')) {
            const rawName = parentNode.item.rawName + '::' + name;
            const fn: TestFunction = { name: name, rawName: rawName };
            parentNode.item.functions.push(fn);
            return;
        }
    });

    return testFiles;
}

function findParentOfCurrentItem(indentOfCurrentItem: number, parentNodes: { indent: number, item: TestFile | TestSuite }[]): { indent: number, item: TestFile | TestSuite } {
    while (parentNodes.length > 0) {
        let parentNode = parentNodes[parentNodes.length - 1];
        if (parentNode.indent < indentOfCurrentItem) {
            return parentNode;
        }
        parentNodes.pop();
        continue;
    }

    return null;
}

function extractBetweenDelimiters(content: string, startDelimiter: string, endDelimiter: string): string {
    content = content.substring(content.indexOf(startDelimiter) + 1);
    return content.substring(0, content.lastIndexOf(endDelimiter));
}

/* Sample output from py.test --collect-only
<Module 'test_another.py'>                                                                                                                          
  <Class 'Test_CheckMyApp'>                                                                                                                         
    <Instance '()'>                                                                                                                                 
      <Function 'test_simple_check'>                                                                                                                
      <Function 'test_complex_check'>                                                                                                               
<Module 'test_one.py'>                                                                                                                              
  <UnitTestCase 'Test_test1'>                                                                                                                       
    <TestCaseFunction 'test_A'>                                                                                                                     
    <TestCaseFunction 'test_B'>                                                                                                                     
<Module 'test_two.py'>                                                                                                                              
  <UnitTestCase 'Test_test1'>                                                                                                                       
    <TestCaseFunction 'test_A2'>                                                                                                                    
    <TestCaseFunction 'test_B2'>                                                                                                                    
<Module 'testPasswords/test_Pwd.py'>                                                                                                                
  <UnitTestCase 'Test_Pwd'>                                                                                                                         
    <TestCaseFunction 'test_APwd'>                                                                                                                  
    <TestCaseFunction 'test_BPwd'>                                                                                                                  
<Module 'testPasswords/test_multi.py'>                                                                                                              
  <Class 'Test_CheckMyApp'>                                                                                                                         
    <Instance '()'>                                                                                                                                 
      <Function 'test_simple_check'>                                                                                                                
      <Function 'test_complex_check'>                                                                                                               
      <Class 'Test_NestedClassA'>                                                                                                                   
        <Instance '()'>                                                                                                                             
          <Function 'test_nested_class_methodB'>                                                                                                    
          <Class 'Test_nested_classB_Of_A'>                                                                                                         
            <Instance '()'>                                                                                                                         
              <Function 'test_d'>                                                                                                                   
  <Function 'test_username'>                                                                                                                        
  <Function 'test_parametrized_username[one]'>                                                                                                      
  <Function 'test_parametrized_username[two]'>                                                                                                      
  <Function 'test_parametrized_username[three]'>  
*/
