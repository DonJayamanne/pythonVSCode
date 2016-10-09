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
    rename<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        let command = { "lookup": "rename", "file": filePath, "start": document.offsetAt(range.start).toString(), "id": "1", "name": name };
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.Rename);
    }
    extractVariable<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        let command = { "lookup": "extract_variable", "file": filePath, "start": document.offsetAt(range.start).toString(), "end": document.offsetAt(range.end).toString(), "id": "1", "name": name };
        return this.sendCommand<T>(JSON.stringify(command), REFACTOR.ExtractVariable);
    }
    extractMethod<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        // Ensure last line is an empty line
        if (!document.lineAt(document.lineCount - 1).isEmptyOrWhitespace && range.start.line === document.lineCount - 1) {
            return Promise.reject<T>('Missing blank line at the end of document (PEP8).')
        }
        let command = { "lookup": "extract_method", "file": filePath, "start": document.offsetAt(range.start).toString(), "end": document.offsetAt(range.end).toString(), "id": "1", "name": name };
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
            let environmentVariables = { 'PYTHONUNBUFFERED': '1' };
            for (let setting in process.env) {
                if (!environmentVariables[setting]) {
                    environmentVariables[setting] = process.env[setting];
                }
            }
            this._process = child_process.spawn(pythonPath, ['refactor.py', this.workspaceRoot],
                {
                    cwd: path.join(this._extensionDir, 'pythonFiles'),
                    env: environmentVariables
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
        // Possible there was an exception in parsing the data returned
        // So append the data then parse it
        let dataStr = this._previousStdErrData = this._previousStdErrData + data + '';
        let errorResponse: { message: string, traceback: string }[];
        try {
            errorResponse = dataStr.split(/\r?\n/g).filter(line => line.length > 0).map(resp => JSON.parse(resp));
            this._previousStdErrData = '';
        }
        catch (ex) {
            // Possible we've only received part of the data, hence don't clear previousData
            return;
        }

        if (typeof errorResponse[0].message !== 'string' || errorResponse[0].message.length === 0) {
            errorResponse[0].message = errorResponse[0].traceback.split(/\r?\n/g).pop();
        }
        let errorMessage = errorResponse[0].message + '\n' + errorResponse[0].traceback;

        if (this._startedSuccessfully) {
            this._commandReject(`Refactor failed. ${errorMessage}`);
        }
        else {
            this._initializeReject(`Refactor failed. ${errorMessage}`);
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