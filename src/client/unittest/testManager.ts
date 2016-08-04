import {Tests, TestFile, TestSuite, TestFunction} from './contracts';
import {discoverTests, updateResultsFromLogFiles} from './pytestUtils';
import * as vscode from 'vscode';
import {EventEmitter} from 'events';
import {execPythonFile} from "./../common/utils";
import {createDeferred, createTemporaryFile} from '../common/helpers';
import * as fs from 'fs';
import * as path from 'path';

export class TestManager extends EventEmitter {
    private tests: Tests;
    constructor(private rootDirectory: string = vscode.workspace.rootPath, private testDirectory: string = vscode.workspace.rootPath) {
        super();
    }

    public getTestFiles(): Promise<TestFile[]> {
        if (this.tests) {
            return Promise.resolve(this.tests.testFiles);
        }

        return discoverTests(this.rootDirectory, this.testDirectory)
            .then(tests => {
                this.tests = tests;
                return tests.testFiles;
            });
    }

    public runTest(testFile?: TestFile, testSuite?: TestSuite, testFunction?: TestFunction): Promise<TestFile[]> {
        return runTest(this.rootDirectory, this.testDirectory, this.tests, testFile, testSuite, testFunction).then(() => this.tests.testFiles);
    }
}

function runTest(rootDirectory: string, testDirectory: string, tests: Tests, testFile?: TestFile, testSuite?: TestSuite, testFunction?: TestFunction): Promise<any> {
    let testPath = "";
    if (testFile) {
        testPath = testFile.rawName;
    }
    if (testSuite) {
        testPath = testSuite.rawName;
    }
    if (testFunction) {
        testPath = testFunction.rawName
    }

    if (testPath.length === 0) {
        testPath = testDirectory;
    }
    else {
        // Remove the ():: from the name
        testPath = testDirectory + path.sep + testPath.replace(/\(\)::/g, '');
    }

    const tmpDir = path.join(vscode.workspace.rootPath, '.vscode', 'tmp');
    let xmlLogFile = "";
    let xmlLogFileCleanup: Function = null;
    let rawLogFile = "";
    let rawLogFileCleanup: Function = null;

    return createTmpDir(tmpDir).then(() => {
        return createTemporaryFile('.xml', tmpDir);
    }).then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;

        return createTemporaryFile('.log', tmpDir);
    }).then(rawLowResult => {
        rawLogFile = rawLowResult.filePath;
        rawLogFileCleanup = rawLowResult.cleanupCallback;

        //return execPythonFile('py.test', [testPath, `--junitxml="${xmlLogFile}"`, `--resultlog=${rawLogFile}`], rootDirectory);
        return execPythonFile('py.test', [testPath, `--junitxml=${xmlLogFile}`, `--resultlog=${rawLogFile}`], rootDirectory);
        //return execPythonFile('py.test', [testPath, `--junitxml=${xmlLogFile}`], rootDirectory);
    }).then(() => {
        return updateResultsFromLogFiles(tests, xmlLogFile, rawLogFile);
    }).then(result => {
        xmlLogFileCleanup();
        rawLogFileCleanup();
        return result;
    });
}

function createTmpDir(tmpDir: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        fs.exists(tmpDir, (exists) => {
            if (exists) {
                return resolve();
            }

            fs.mkdir(tmpDir, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}