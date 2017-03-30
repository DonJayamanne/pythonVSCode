'use strict';
import { PythonSettings } from '../../common/configSettings';
import { TestsToRun, Tests, TestStatus } from '../common/contracts';
import { runTest } from './runner';
import * as vscode from 'vscode';
import { discoverTests } from './collector';
import { BaseTestManager } from '../common/baseTestManager';
import { Product } from '../../common/installer';

const settings = PythonSettings.getInstance();
export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super('unitest', Product.unittest, rootDirectory, outputChannel);
    }
    configure() {
    }
    discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        let args = settings.unitTest.unittestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken, ignoreCache, this.outputChannel);
    }
    runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        let args = settings.unitTest.unittestArgs.slice(0);
        if (runFailedTests === true) {
            testsToRun = { testFile: [], testFolder: [], testSuite: [], testFunction: [] };
            testsToRun.testFunction = tests.testFunctions.filter(fn => {
                return fn.testFunction.status === TestStatus.Error || fn.testFunction.status === TestStatus.Fail;
            }).map(fn => fn.testFunction);
        }
        return runTest(this, this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel, debug);
    }
}
