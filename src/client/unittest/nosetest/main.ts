'use strict';
import {PythonSettings} from '../../common/configSettings';
import {OutputChannel, window} from 'vscode';
import {TestsToRun, Tests} from '../contracts';
import * as vscode from 'vscode';
import {discoverTests} from './collector';
import {BaseTestManager} from '../testUtils';
import {runTest} from './runner';

const settings = PythonSettings.getInstance();

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super(rootDirectory, outputChannel);
    }
    discoverTestsImpl(): Promise<Tests> {
        let args = settings.unitTest.pyTestArgs.splice(0);
        return discoverTests(this.rootDirectory, args, this.cancellationToken);
    }
    runTestImpl(testsToRun?: TestsToRun, runFailedTests?: boolean): Promise<any> {
        let args = settings.unitTest.pyTestArgs.splice(0);
        if (runFailedTests === true && args.indexOf('--failed') === -1) {
            args.push('--failed');
        }
        return runTest(this.rootDirectory, this.tests, args, testsToRun, this.stdOut.bind(this), this.cancellationToken);
    }
}
