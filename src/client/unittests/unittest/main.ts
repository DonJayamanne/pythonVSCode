'use strict';
import * as vscode from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/installer';
import { BaseTestManager } from '../common/baseTestManager';
import { Tests, TestStatus, TestsToRun } from '../common/contracts';
import { ITestCollectionStorageService } from '../common/testUtils';
import { discoverTests } from './collector';
import { runTest } from './runner';
export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel, testCollectionStorage: ITestCollectionStorageService) {
        super('unitest', Product.unittest, rootDirectory, outputChannel, testCollectionStorage);
    }
    // tslint:disable-next-line:no-empty
    public configure() {
    }
    public discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken, ignoreCache, this.outputChannel);
    }
    public runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        const args = this.settings.unitTest.unittestArgs.slice(0);
        if (runFailedTests === true) {
            testsToRun = { testFile: [], testFolder: [], testSuite: [], testFunction: [] };
            testsToRun.testFunction = tests.testFunctions.filter(fn => {
                return fn.testFunction.status === TestStatus.Error || fn.testFunction.status === TestStatus.Fail;
            }).map(fn => fn.testFunction);
        }
        return runTest(this, this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel, debug);
    }
}
