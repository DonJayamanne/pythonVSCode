"use strict";

import * as baseTestRunner from "./baseTestRunner";
import * as settings from "./../common/configSettings";
import {OutputChannel} from "vscode";

export class PyTestTests extends baseTestRunner.BaseTestRunner {
    constructor(pythonSettings: settings.IPythonSettings, outputChannel: OutputChannel, workspaceRoot: string) {
        super("pytest", pythonSettings, outputChannel, true, workspaceRoot);
    }

    public isEnabled(): boolean {
        return this.pythonSettings.unitTest.pyTestEnabled;
    }

    public runTests(): Promise<any> {
        if (!this.pythonSettings.unitTest.pyTestEnabled) {
            return Promise.resolve();
        }

        let pyTestPath = this.pythonSettings.unitTest.pyTestPath;
        let pytestArgs = Array.isArray(this.pythonSettings.unitTest.pyTestArgs) ? this.pythonSettings.unitTest.pyTestArgs : [];
        return new Promise<any>(resolve => {
            this.run(pyTestPath, pytestArgs).then(messages => {
                resolve(messages);
            });
        });
    }
}