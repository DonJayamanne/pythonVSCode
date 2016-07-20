'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import {ExtractResult} from './contracts';
import {execPythonFile} from '../common/utils';
import {PythonSettings} from '../common/configSettings';

const ROPE_PYTHON_VERSION = 'Refactor requires Python 2.x. Set \'python.pythonRopePath\' in Settings.json';

export class RefactorProxy extends vscode.Disposable {
    private _process: child_process.ChildProcess;
    private _extensionDir: string;
    private _previousOutData: string = '';
    private _startedSuccessfully: boolean = false;
    private _commandResolve: (value?: any | PromiseLike<any>) => void;
    private _commandReject: (reason?: any) => void;
    private _initializeReject: (reason?: any) => void;
    static pythonPath: string;
    private _settings: PythonSettings;
    constructor(extensionDir: string, private workspaceRoot: string = vscode.workspace.rootPath) {
        super(() => { });
        this._extensionDir = extensionDir;
        this._settings = PythonSettings.getInstance();
        vscode.workspace.onDidChangeConfiguration(() => {
            RefactorProxy.pythonPath = '';
        });
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
        let command = `{"lookup":"extract_variable", "file":"${filePath}", "start":"${document.offsetAt(range.start)}", "end":"${document.offsetAt(range.end)}", "id":"1", "name":"${name}"}`;
        return this.sendCommand<T>(command);
    }
    extractMethod<T>(document: vscode.TextDocument, name: string, filePath: string, range: vscode.Range): Promise<T> {
        let command = `{"lookup":"extract_method", "file":"${filePath}", "start":"${document.offsetAt(range.start)}", "end":"${document.offsetAt(range.end)}", "id":"1","name":"${name}"}`;
        return this.sendCommand<T>(command);
    }
    private sendCommand<T>(command: string): Promise<T> {
        console.log('sendCommand');
        return this.pickValidPythonPath().then(pythonPath => {
            console.log('Got Path' + pythonPath);
            return this.initialize(pythonPath);
        }).then(() => {
            return new Promise<T>((resolve, reject) => {
                this._commandResolve = resolve;
                this._commandReject = reject;
                console.log('Snd Command' + command);
                this._process.stdin.write(command + '\n');
            });
        });
    }

    private pickValidPythonPath(): Promise<string> {
        if (RefactorProxy.pythonPath && RefactorProxy.pythonPath.length > 0) {
            return Promise.resolve(RefactorProxy.pythonPath);
        }

        if (this._settings.pythonPath === this._settings.python2Path) {
            // First try what ever path we have in pythonRopePath
            return this.checkIfPythonVersionIs3(this._settings.python2Path).then(() => {
                return this._settings.python2Path;
            });
        }

        // First try what ever path we have in pythonRopePath
        return this.checkIfPythonVersionIs3(this._settings.python2Path).then(() => {
            return this._settings.python2Path;
        }).catch(() => {
            // Now the path in pythonPath
            return this.checkIfPythonVersionIs3(this._settings.pythonPath).then(() => {
                return this._settings.pythonPath;
            });
        });
    }

    private checkIfPythonVersionIs3(pythonPath: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.version)'], null, (error, stdout, stderr) => {
                if (stdout.indexOf('3.') === 0) {
                    reject(new Error(ROPE_PYTHON_VERSION));
                }
                resolve(true);
            });
        });
    }
    private initialize(pythonPath: string): Promise<string> {
        return new Promise<any>((resolve, reject) => {
            this._initializeReject = reject;
            this._process = child_process.spawn(pythonPath, ['-u', 'refactor.py', this.workspaceRoot, path.join(this.workspaceRoot, '.vscode', 'rope')],
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
                    // We know this works, hence keep tarck of this python path
                    RefactorProxy.pythonPath = pythonPath;
                    return resolve();
                }
                that.onData(data);
            });
        });
    }
    private handleStdError(data: string) {
        console.log('handleStdError');
        let dataStr = this._previousOutData = this._previousOutData + data + '';
        console.log('handleStdError - ' + dataStr);
        if (this._startedSuccessfully) {
            let lengthOfHeader = dataStr.indexOf(':') + 1;
            let lengthOfMessage = parseInt(dataStr.substring(0, lengthOfHeader - 1));
            if (dataStr.length === lengthOfMessage + lengthOfHeader) {
                this._previousOutData = '';
                this.dispose();

                let errorLines = dataStr.substring(lengthOfHeader + 1).split(/\r?\n/g);
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
        console.log('handleError');
        console.log('handleError - ' + error);
        if (this._startedSuccessfully) {
            return this._commandReject(error);
        }
        this._initializeReject(error);
    }
    private onData(data: string) {
        if (!this._commandResolve) { return; }
        console.log('onData - ' + data);
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
        console.log('onData - ' + response);
        this.dispose();
        this._commandResolve(response[0]);
        this._commandResolve = null;
    }
}