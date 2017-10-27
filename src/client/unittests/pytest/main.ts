'use strict';
import * as vscode from 'vscode';
import { Product } from '../../common/installer';
import { BaseTestManager } from '../common/baseTestManager';
import { Tests, TestsToRun } from '../common/contracts';
import { ITestCollectionStorageService } from '../common/testUtils';
import { discoverTests } from './collector';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel, testCollectionStorage: ITestCollectionStorageService) {
        super('pytest', Product.pytest, rootDirectory, outputChannel, testCollectionStorage);
    }
    public discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken, ignoreCache, this.outputChannel);
    }
    public runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<{}> {
        const args = this.settings.unitTest.pyTestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel, debug);
    }
}
