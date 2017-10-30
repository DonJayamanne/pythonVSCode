'use strict';
import { TestsToRun, Tests } from '../common/contracts';
import { runTest } from './runner';
import * as vscode from 'vscode';
import { discoverTests } from './collector';
import { BaseTestManager } from '../common/baseTestManager';
import { Product } from '../../common/installer';

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super('pytest', Product.pytest, rootDirectory, outputChannel);
    }
    discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        let args = this.settings.unitTest.pyTestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.testDiscoveryCancellationToken, ignoreCache, this.outputChannel);
    }
    runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        let args = this.settings.unitTest.pyTestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.testRunnerCancellationToken, this.outputChannel, debug);
    }
}
