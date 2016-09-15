// http://jupyter-client.readthedocs.io/en/latest/messaging.html#to-do

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import {KernelspecMetadata} from './contracts';
const jmp = require('jmp');
const uuid = require('uuid');
const zmq = jmp.zmq;

export abstract class Kernel {
    protected statusBar: vscode.StatusBarItem;
    private watchCallbacks: any[];
    constructor(public kernelSpec: KernelspecMetadata, private language: string) {
        this.watchCallbacks = [];
        this.statusBar = vscode.window.createStatusBarItem();
    }

    public addWatchCallback(watchCallback) {
        return this.watchCallbacks.push(watchCallback);
    };

    public _callWatchCallbacks() {
        return this.watchCallbacks.forEach(watchCallback => {
            watchCallback();
        });
    };

    public abstract interrupt();
    public abstract shutdown();
    public abstract execute(code, onResults);
    public abstract executeWatch(code, onResults);
    public abstract complete(code, onResults);
    public abstract inspect(code, cursor_pos, onResults);

    public _parseIOMessage(message) {
        let result = this._parseDisplayIOMessage(message);
        if (result == null) {
            result = this._parseResultIOMessage(message);
        }
        if (result == null) {
            result = this._parseErrorIOMessage(message);
        }
        if (result == null) {
            result = this._parseStreamIOMessage(message);
        }
        return result;
    };

    public _parseDisplayIOMessage(message) {
        if (message.header.msg_type === 'display_data') {
            return this._parseDataMime(message.content.data);
        }
        return null;
    };

    public _parseResultIOMessage(message) {
        const msg_type = message.header.msg_type;
        if (msg_type === 'execute_result' || msg_type === 'pyout') {
            return this._parseDataMime(message.content.data);
        }
        return null;
    };

    public _parseDataMime(data) {
        if (data == null) {
            return null;
        }
        const mime = this._getMimeType(data);
        if (mime == null) {
            return null;
        }
        let result;
        if (mime === 'text/plain') {
            result = {
                data: {
                    'text/plain': data[mime]
                },
                type: 'text',
                stream: 'pyout'
            };
            result.data['text/plain'] = result.data['text/plain'].trim();
        } else {
            result = {
                data: {},
                type: mime,
                stream: 'pyout'
            };
            result.data[mime] = data[mime];
        }
        return result;
    };

    public _getMimeType(data) {
        const imageMimes = Object.getOwnPropertyNames(data).filter(mime => {
            return mime.startsWith('image/');
        });
        let mime;
        if (data.hasOwnProperty('text/html')) {
            mime = 'text/html';
        } else if (data.hasOwnProperty('image/svg+xml')) {
            mime = 'image/svg+xml';
        } else if (!(imageMimes.length === 0)) {
            mime = imageMimes[0];
        } else if (data.hasOwnProperty('text/markdown')) {
            mime = 'text/markdown';
        } else if (data.hasOwnProperty('application/pdf')) {
            mime = 'application/pdf';
        } else if (data.hasOwnProperty('text/latex')) {
            mime = 'text/latex';
        } else if (data.hasOwnProperty('application/javascript')) {
            mime = 'application/javascript';
        } else if (data.hasOwnProperty('application/json')) {
            mime = 'application/json';
        } else if (data.hasOwnProperty('text/plain')) {
            mime = 'text/plain';
        }
        return mime;
    };

    public _parseErrorIOMessage(message) {
        const msg_type = message.header.msg_type;
        if (msg_type === 'error' || msg_type === 'pyerr') {
            return this._parseErrorMessage(message);
        }
        return null;
    };

    public _parseErrorMessage(message) {
        let errorString: string;
        try {
            errorString = message.content.traceback.join('\n');
        } catch (err) {
            const ename = message.content.ename != null ? message.content.ename : '';
            const evalue = message.content.evalue != null ? message.content.evalue : '';
            errorString = ename + ': ' + evalue;
        }
        return {
            data: {
                'text/plain': errorString
            },
            type: 'text',
            stream: 'error'
        };
    };

    public _parseStreamIOMessage(message) {
        let result;
        if (message.header.msg_type === 'stream') {
            result = {
                data: {
                    'text/plain': message.content.text != null ? message.content.text : message.content.data
                },
                type: 'text',
                stream: message.content.name
            };
        } else if (message.idents === 'stdout' || message.idents === 'stream.stdout' || message.content.name === 'stdout') {
            result = {
                data: {
                    'text/plain': message.content.text != null ? message.content.text : message.content.data
                },
                type: 'text',
                stream: 'stdout'
            };
        } else if (message.idents === 'stderr' || message.idents === 'stream.stderr' || message.content.name === 'stderr') {
            result = {
                data: {
                    'text/plain': message.content.text != null ? message.content.text : message.content.data
                },
                type: 'text',
                stream: 'stderr'
            };
        }
        if ((result != null ? result.data['text/plain'] : void 0) != null) {
            result.data['text/plain'] = result.data['text/plain'].trim();
        }
        return result;
    };

    public destroy() {
        return console.log('Kernel: Destroying base kernel');
    };
}