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
        return discoverTests(this.rootDirectory, this.cancellationToken);
    }
    runTestImpl(testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any> {
        let args = settings.unitTest.pyTestArgs.splice(0);
        if (runFailedTests === true && args.indexOf('--lf') === -1 && args.indexOf('--last-failed') === -1) {
            args.push('--last-failed');
        }
        return runTest(this.rootDirectory, this.tests, testsToRun, this.stdOut.bind(this), args, this.cancellationToken);
    }
}
