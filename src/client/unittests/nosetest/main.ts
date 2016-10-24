'use strict';
import {PythonSettings} from '../../common/configSettings';
import {OutputChannel} from 'vscode';
import {TestsToRun, Tests} from '../common/contracts';
import * as vscode from 'vscode';
import {discoverTests} from './collector';
import {BaseTestManager} from '../common/baseTestManager';
import {runTest} from './runner';
import { Product } from '../../common/installer';

const settings = PythonSettings.getInstance();

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super('nosetest', Product.nosetest, rootDirectory, outputChannel);
    }
    discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        let args = settings.unitTest.nosetestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken);
    }
    runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any> {
        let args = settings.unitTest.nosetestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.push('--failed');
        }
        if (args.indexOf('--with-id') === -1){
            args.push('--with-id');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel);
    }
}
