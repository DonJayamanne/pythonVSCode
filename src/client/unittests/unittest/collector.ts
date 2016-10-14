'use strict';
import { execPythonFile } from './../../common/utils';
import { TestFile, Tests, TestStatus } from '../common/contracts';
import { flattenTestFiles } from '../common/testUtils';
import * as vscode from 'vscode';
import * as path from 'path';
import { PythonSettings } from '../../common/configSettings';

const pythonSettings = PythonSettings.getInstance();

export function discoverTests(rootDirectory: string, args: string[], token: vscode.CancellationToken): Promise<Tests> {
    let startDirectory = '.';
    let pattern = 'test*.py';
    const indexOfStartDir = args.findIndex(arg => arg.indexOf('-s') === 0);
    if (indexOfStartDir >= 0) {
        const startDir = args[indexOfStartDir].trim();
        if (startDir.trim() === '-s' && args.length >= indexOfStartDir) {
            // Assume the next items is the directory
            startDirectory = args[indexOfStartDir + 1];
        }
        else {
            startDirectory = startDir.substring(2).trim();
            if (startDirectory.startsWith('=') || startDirectory.startsWith(' ')) {
                startDirectory = startDirectory.substring(1);
            }
        }
    }
    const indexOfPattern = args.findIndex(arg => arg.indexOf('-p') === 0);
    if (indexOfPattern >= 0) {
        const patternValue = args[indexOfPattern].trim();
        if (patternValue.trim() === '-p' && args.length >= indexOfPattern) {
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
    const pythonScript = `import unittest
loader = unittest.TestLoader()
suites = loader.discover("${startDirectory}", pattern="${pattern}")
print("start") #Don't remove this line
for suite in suites._tests:
    for cls in suite._tests:
        try:
            for m in cls._tests:
                print(m.id())
        except:
            pass`;

    let startedCollecting = false;
    let testItems: string[] = [];
    function processOutput(output: string) {
        output.split(/\r?\n/g).forEach((line, index, lines) => {
            if (token && token.isCancellationRequested) {
                return;
            }
            if (!startedCollecting) {
                if (line === 'start') {
                    startedCollecting = true;
                }
                return;
            }
            line = line.trim();
            if (line.length === 0) {
                return;
            }
            testItems.push(line);
        });
    }
    args = [];
    return execPythonFile(pythonSettings.pythonPath, args.concat(['-c', pythonScript]), rootDirectory, true, null, token)
        .then(data => {
            processOutput(data);
            if (token && token.isCancellationRequested) {
                return Promise.reject<Tests>('cancelled');
            }

            let testsDirectory = rootDirectory;
            if (startDirectory.length > 1) {
                testsDirectory = path.isAbsolute(startDirectory) ? startDirectory : path.resolve(rootDirectory, startDirectory);
            }
            return parseTestIds(testsDirectory, testItems);
        });
}

function parseTestIds(rootDirectory: string, testIds: string[]): Tests {
    const testFiles: TestFile[] = [];
    testIds.forEach(testId => {
        addTestId(rootDirectory, testId, testFiles);
    });

    return flattenTestFiles(testFiles);
}

function addTestId(rootDirectory: string, testId: string, testFiles: TestFile[]) {
    const testIdParts = testId.split('.');
    // We must have a file, class and function name
    if (testIdParts.length <= 2) {
        return null;
    }

    const paths = testIdParts.slice(0, testIdParts.length - 2);
    const filePath = path.join(rootDirectory, ...paths) + '.py';
    const functionName = testIdParts.pop();
    const className = testIdParts.pop();

    // Check if we already have this test file
    let testFile = testFiles.find(test => test.fullPath === filePath);
    if (!testFile) {
        testFile = {
            name: path.basename(filePath),
            fullPath: filePath,
            functions: [],
            suites: [],
            nameToRun: `${className}.${functionName}`,
            xmlName: '',
            status: TestStatus.Idle,
            time: 0
        };
        testFiles.push(testFile);
    }

    // Check if we already have this test file
    const classNameToRun = className;
    let testSuite = testFile.suites.find(cls => cls.nameToRun === classNameToRun);
    if (!testSuite) {
        testSuite = {
            name: className,
            functions: [],
            suites: [],
            isUnitTest: true,
            isInstance: false,
            nameToRun: classNameToRun,
            xmlName: '',
            status: TestStatus.Idle,
            time: 0
        };
        testFile.suites.push(testSuite);
    }

    const testFunction = {
        name: functionName,
        nameToRun: testId,
        status: TestStatus.Idle,
        time: 0
    };

    testSuite.functions.push(testFunction);
}