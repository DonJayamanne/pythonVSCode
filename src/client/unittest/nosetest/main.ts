'use strict';
import {OutputChannel, window} from 'vscode';
import {TestsToRun, Tests} from '../contracts';
import * as vscode from 'vscode';
import {discoverTests} from './collector';
import {BaseTestManager} from '../testUtils';
import {runTest} from './runner';

export class TestManager extends BaseTestManager {
    constructor(rootDirectory: string, outputChannel: vscode.OutputChannel) {
        super(rootDirectory, outputChannel);
    }
    discoverTestsImpl(): Promise<Tests> {
        return discoverTests(this.rootDirectory, []);
    }
    runTestImpl(testsToRun?: TestsToRun): Promise<any> {
        return runTest(this.rootDirectory, this.tests, testsToRun, this.stdOut.bind(this));
    }
}
