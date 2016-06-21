"use strict";

import * as path from "path";
import * as baseTestRunner from "./baseTestRunner";
import * as settings from "./../common/configSettings";
import {OutputChannel} from "vscode";

export class NoseTests extends baseTestRunner.BaseTestRunner {
    constructor(pythonSettings: settings.IPythonSettings, outputChannel: OutputChannel, workspaceRoot: string) {
        super("nosetests", pythonSettings, outputChannel, true, workspaceRoot);
    }
    public isEnabled(): boolean {
        return this.pythonSettings.unitTest.nosetestsEnabled;
    }
    public runTests(): Promise<any> {
        if (!this.pythonSettings.unitTest.nosetestsEnabled) {
            return Promise.resolve();
        }

        let nosetestsPath = this.pythonSettings.unitTest.nosetestPath;
        return new Promise<any>(resolve => {
            this.run(nosetestsPath, []).then(messages => {
                resolve(messages);
            });
        });
    }
}
