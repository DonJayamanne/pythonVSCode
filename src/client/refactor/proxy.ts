'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import {ExtractResult} from './contracts';
import {execPythonFile} from '../common/utils';
import {IPythonSettings} from '../common/configSettings';
import {REFACTOR} from '../common/telemetryContracts';
import {sendTelemetryEvent, Delays} from '../common/telemetry';

const ROPE_PYTHON_VERSION = 'Currently code refactoring is only supported in Python 2.x';
const ERROR_PREFIX = '$ERROR';

export class RefactorProxy extends vscode.Disposable {
    private _process: child_process.ChildProcess;
    private _extensionDir: string;
    private _previousOutData: string = '';
    private _previousStdErrData: string = '';
    private _startedSuccessfully: boolean = false;
    private _commandResolve: (value?: any | PromiseLike<any>) => void;
    private _commandReject: (reason?: any) => void;
    private _initializeReject: (reason?: any) => void;
    constructor(extensionDir: string, private pythonSettings: IPythonSettings, private workspaceRoot: string = vscode.workspace.rootPath) {
        super(() => { });
        this._extensionDir = extensionDir;
    }

    dispose() {
        try {
            this._process.kill();
        }
        catch (ex) {
        }
        this._process = null;
    }
    extractVariable<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        let command = {"lookup":"extract_variable", "file":filePath, "start":document.offsetAt(range.start).toString(), "end":document.offsetAt(range.end).toString(), "id":"1", "name":name};
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.ExtractVariable);
    }
    extractMethod<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        let command = {"lookup":"extract_method", "file":filePath, "start":document.offsetAt(range.start).toString(), "end":document.offsetAt(range.end).toString(), "id":"1","name":name};
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.ExtractVariable);
    } 
    private sendCommand<T>(command: string, telemetryEvent: string): Promise<T> {
        let timer = new Delays();
        return this.initialize(this.pythonSettings.pythonPath).then(() => {
            return new Promise<T>((resolve, reject) => {
                this._commandResolve = resolve;
                this._commandReject = reject;
                this._process.stdin.write(command + '\n');
            });
        }).then(value => {
            timer.stop();
            sendTelemetryEvent(telemetryEvent, null, timer.toMeasures());
            return value;
        }).catch(reason => {
            timer.stop();
            sendTelemetryEvent(telemetryEvent, null, timer.toMeasures());
            return Promise.reject(reason);
        });
    }
    private initialize(pythonPath: string): Promise<string> {
        return new Promise<any>((resolve, reject) => {
            this._initializeReject = reject;
            this._process = child_process.spawn(pythonPath, ['-u', 'refactor.py', this.workspaceRoot],
                {
                    cwd: path.join(this._extensionDir, 'pythonFiles')
                });
            this._process.stderr.on('data', this.handleStdError.bind(this));
            this._process.on('error', this.handleError.bind(this));

            let that = this;
            this._process.stdout.on('data', data => {
                let dataStr: string = data + '';
                if (!that._startedSuccessfully && dataStr.startsWith('STARTED')) {
                    that._startedSuccessfully = true;
                    return resolve();
                }
                that.onData(data);
            });
        });
    }
    private handleStdError(data: string) {
        let dataStr = this._previousStdErrData = this._previousStdErrData + data + '';
        if (this._startedSuccessfully) {
            // The Rope library can send other (warning) messages in the stderr stream
            // Hence look for the prefix, if we don't have the prefix ignore them
            if (!dataStr.startsWith(ERROR_PREFIX)) {
                this._previousStdErrData = '';
                return;
            }

            let lengthOfHeader = dataStr.indexOf(':') + 1;
            let lengthOfMessage = parseInt(dataStr.substring(ERROR_PREFIX.length, lengthOfHeader - 1));
            if (dataStr.length >= lengthOfMessage + lengthOfHeader) {
                this._previousStdErrData = '';
                this.dispose();

                let errorLines = dataStr.substring(lengthOfHeader).split(/\r?\n/g);
                let hasErrorMessage = errorLines[0].trim().length > 0;
                errorLines = errorLines.filter(line => line.length > 0);
                let errorMessage = errorLines.join('\n');

                // If there is no error message take the last line from the error (stack)
                // As this generally contains the actual error
                if (!hasErrorMessage) {
                    errorMessage = errorLines[errorLines.length - 1].trim() + '\n' + errorMessage;
                }

                this._commandReject(`Refactor failed. ${errorMessage}`);
            }
        }
        else {
            this._initializeReject(`Refactor failed. ${dataStr}`);
        }
    }
    private handleError(error: Error) {
        if (this._startedSuccessfully) {
            return this._commandReject(error);
        }
        this._initializeReject(error);
    }
    private onData(data: string) {
        if (!this._commandResolve) { return; }

        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousOutData = this._previousOutData + data + '';
        let response: any;
        try {
            response = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousOutData = '';
        }
        catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }
        this.dispose();
        this._commandResolve(response[0]);
        this._commandResolve = null;
    }
}