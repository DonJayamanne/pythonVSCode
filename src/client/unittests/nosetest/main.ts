'use strict';
import {PythonSettings} from '../../common/configSettings';
import {OutputChannel, window} from 'vscode';
import {TestsToRun, Tests} from '../common/contracts';
import * as vscode from 'vscode';
import {discoverTests} from './collector';
import {BaseTestManager} from '../common/baseTestManager';
import {runTest} from './runner';

const settings = PythonSettings.getInstance();

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super('nosetest', rootDirectory, outputChannel);
    }
    discoverTestsImpl(ignoreCache: boolean): Promise<Tests> {
        let args = settings.unitTest.pyTestArgs.slice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken);
    }
    runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any> {
        let args = settings.unitTest.pyTestArgs.slice(0);
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.push('--failed');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.cancellationToken, this.outputChannel);
    }
}
