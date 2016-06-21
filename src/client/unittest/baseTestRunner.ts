"use strict";
import * as child_process from "child_process";
import * as path from "path";
import { exec } from "child_process";
import {execPythonFile} from "./../common/utils";
import * as settings from "./../common/configSettings";
import {OutputChannel, window} from "vscode";

export abstract class BaseTestRunner {
    public Id: string;
    protected pythonSettings: settings.IPythonSettings;
    protected outputChannel: OutputChannel;
    private includeErrorAsResponse: boolean;
    constructor(id: string, pythonSettings: settings.IPythonSettings, outputChannel: OutputChannel, includeErrorAsResponse: boolean = false, protected workspaceRootPath: string) {
        this.Id = id;
        this.pythonSettings = pythonSettings;
        this.outputChannel = outputChannel;
        this.includeErrorAsResponse = includeErrorAsResponse;
    }

    public runTests(): Promise<any> {
        return Promise.resolve();
    }
    public abstract isEnabled(): boolean;
    protected run(command: string, args: string[]): Promise<any> {
        let outputChannel = this.outputChannel;
        let linterId = this.Id;

        return new Promise<any>((resolve, reject) => {
            execPythonFile(command, args, this.workspaceRootPath, this.includeErrorAsResponse).then(data => {
                outputChannel.append(data);
                outputChannel.show();
            }, error => {
                outputChannel.append(error);
                outputChannel.show();
            });
        });
    }
}
