'use strict';
import { OutputChannel } from 'vscode';
import * as vscode from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/installer';
import { BaseTestManager } from '../common/baseTestManager';
import { Tests, TestsToRun } from '../common/contracts';
import { ITestCollectionStorageService } from '../common/testUtils';
import { discoverTests } from './collector';
import { runTest } from './runner';

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel, testCollectionStorage: ITestCollectionStorageService) {
        super('nosetest', Product.nosetest, rootDirectory, outputChannel, testCollectionStorage);
    }
    public discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken, ignoreCache, this.outputChannel);
    }
    // tslint:disable-next-line:no-any
    public runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        const args = this.settings.unitTest.nosetestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.push('--failed');
        }
        if (!runFailedTests && args.indexOf('--with-id') === -1) {
            args.push('--with-id');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel, debug);
    }
}
