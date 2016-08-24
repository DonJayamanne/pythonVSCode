'use strict';
import {PythonSettings} from '../../common/configSettings';
import {TestsToRun, Tests} from '../contracts';
import {runTest} from './runner';
import * as vscode from 'vscode';
import {discoverTests} from './collector';
import {BaseTestManager} from '../testUtils';

const settings = PythonSettings.getInstance();
export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super(rootDirectory, outputChannel);
    }
    discoverTestsImpl(): Promise<Tests> {
        let args = settings.unitTest.pyTestArgs.splice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken);
    }
    runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any> {
        let args = settings.unitTest.pyTestArgs.splice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        return runTest(this.rootDirectory, tests, args, testsToRun, this.stdOut.bind(this), this.cancellationToken);
    }
}
