import {Tests, TestFile, TestSuite, TestFunction, TestStatus} from './contracts';
import {discoverTests, updateResultsFromLogFiles} from './pytestUtils';
import * as vscode from 'vscode';
import {EventEmitter} from 'events';
import {execPythonFile} from './../common/utils';
import {createDeferred, createTemporaryFile} from '../common/helpers';
import * as fs from 'fs';
import * as path from 'path';


export class TestManager extends EventEmitter {
    private tests: Tests;
    private lastError: any;
    private _status: TestStatus = TestStatus.Unknown;
    public get status(): TestStatus {
        return this._status;
    }
    constructor(private rootDirectory: string = vscode.workspace.rootPath, private testDirectory: string = vscode.workspace.rootPath) {
        super();
    }

    public reset() {
        this._status = TestStatus.Unknown;
        this.tests = null;
        this.lastError = null;
    }

    private get testsAreRunning(): Boolean {
        return this._runningTestsCounter > 0;
    }

    private updateStatus() {
        if (this.testsAreRunning) {
            this._status = TestStatus.Running;
            return;
        }
        if (this.lastError) {
            this._status = TestStatus.Error;
            return;
        }
        if (this.tests) {
            this._status = TestStatus.Idle;
            return;
        }
    }
    public getTestFiles(): Promise<TestFile[]> {
        if (this.tests) {
            return Promise.resolve(this.tests.testFiles);
        }
        if (this.lastError) {
            return Promise.reject<TestFile[]>(this.lastError);
        }

        this._status = TestStatus.Discovering;

        return discoverTests(this.rootDirectory, this.testDirectory)
            .then(tests => {
                this.tests = tests;
                this.lastError = null;
                this.updateStatus();
                return tests.testFiles;
            }).catch(reason => {
                this.tests = null;
                this.lastError = reason;
                this.updateStatus();
                return Promise.reject(reason);
            });
    }
    private _runningTestsCounter: number = 0;
    public runTest(testFile?: TestFile, testSuite?: TestSuite, testFunction?: TestFunction): Promise<TestFile[]> {
        this._runningTestsCounter += 1;
        this.updateStatus();
        return runTest(this.rootDirectory, this.testDirectory, this.tests, testFile, testSuite, testFunction)
            .then(() => {
                this.tests.testFiles;
                this._runningTestsCounter -= 1;
                this.updateStatus();
                return this.tests.testFiles;
            }).catch(reason => {
                this._runningTestsCounter -= 1;
                this.updateStatus();
                return Promise.reject(reason);
            });
    }
}

function runTest(rootDirectory: string, testDirectory: string, tests: Tests, testFile?: TestFile, testSuite?: TestSuite, testFunction?: TestFunction): Promise<any> {
    let testPath = '';
    if (testFile) {
        testPath = testFile.rawName;
    }
    if (testSuite) {
        testPath = testSuite.rawName;
    }
    if (testFunction) {
        testPath = testFunction.rawName;
    }

    if (testPath.length === 0) {
        testPath = testDirectory;
    }
    else {
        // Remove the ():: from the name
        testPath = testDirectory + path.sep + testPath.replace(/\(\)::/g, '');
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

        // return execPythonFile('py.test', [testPath, `--junitxml="${xmlLogFile}"`, `--resultlog=${rawLogFile}`], rootDirectory);
        return execPythonFile('py.test', [testPath, `--junitxml=${xmlLogFile}`, `--resultlog=${rawLogFile}`], rootDirectory);
        // return execPythonFile('py.test', [testPath, `--junitxml=${xmlLogFile}`], rootDirectory);
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