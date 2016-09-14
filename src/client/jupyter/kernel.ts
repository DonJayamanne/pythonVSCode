import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
const _ = require('lodash');
const jmp = require('jmp');
const uuid = require('uuid');
const zmq = jmp.zmq;

// let StatusView, WatchSidebar;
// StatusView = require('./status-view');

// WatchSidebar = require('./watch-sidebar');

export class Kernel {
    protected statusBar: vscode.StatusBarItem;
    private watchCallbacks: any[];
    constructor(public kernelSpec: any, private grammar: any) {
        this.watchCallbacks = [];
        this.statusBar = vscode.window.createStatusBarItem();
        // this.watchSidebar = new WatchSidebar(this);
        // this.statusView = new StatusView(this.kernelSpec.display_name);
    }

    public addWatchCallback(watchCallback) {
        return this.watchCallbacks.push(watchCallback);
    };

    public _callWatchCallbacks() {
        return this.watchCallbacks.forEach(function (watchCallback) {
            return watchCallback();
        });
    };

    public interrupt() {
        throw new Error('Kernel: interrupt method not implemented');
    };

    public shutdown() {
        throw new Error('Kernel: shutdown method not implemented');
    };

    public execute(code, onResults) {
        throw new Error('Kernel: execute method not implemented');
    };

    public executeWatch(code, onResults) {
        throw new Error('Kernel: executeWatch method not implemented');
    };

    public complete(code, onResults) {
        throw new Error('Kernel: complete method not implemented');
    };

    public inspect(code, cursor_pos, onResults) {
        throw new Error('Kernel: inspect method not implemented');
    };

    public _parseIOMessage(message) {
        var result;
        result = this._parseDisplayIOMessage(message);
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
        var result;
        if (message.header.msg_type === 'display_data') {
            result = this._parseDataMime(message.content.data);
        }
        return result;
    };

    public _parseResultIOMessage(message) {
        var msg_type, result;
        msg_type = message.header.msg_type;
        if (msg_type === 'execute_result' || msg_type === 'pyout') {
            result = this._parseDataMime(message.content.data);
        }
        return result;
    };

    public _parseDataMime(data) {
        var mime, result;
        if (data == null) {
            return null;
        }
        mime = this._getMimeType(data);
        if (mime == null) {
            return null;
        }
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
        var imageMimes, mime;
        imageMimes = Object.getOwnPropertyNames(data).filter(function (mime) {
            return mime.startsWith('image/');
        });
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
        } else if (data.hasOwnProperty('text/plain')) {
            mime = 'text/plain';
        }
        return mime;
    };

    public _parseErrorIOMessage(message) {
        var msg_type, result;
        msg_type = message.header.msg_type;
        if (msg_type === 'error' || msg_type === 'pyerr') {
            result = this._parseErrorMessage(message);
        }
        return result;
    };

    public _parseErrorMessage(message) {
        var ename, err, errorString, evalue, ref, ref1, result;
        try {
            errorString = message.content.traceback.join('\n');
        } catch (_error) {
            err = _error;
            ename = (ref = message.content.ename) != null ? ref : '';
            evalue = (ref1 = message.content.evalue) != null ? ref1 : '';
            errorString = ename + ': ' + evalue;
        }
        result = {
            data: {
                'text/plain': errorString
            },
            type: 'text',
            stream: 'error'
        };
        return result;
    };

    public _parseStreamIOMessage(message) {
        var ref, ref1, ref2, result;
        if (message.header.msg_type === 'stream') {
            result = {
                data: {
                    'text/plain': (ref = message.content.text) != null ? ref : message.content.data
                },
                type: 'text',
                stream: message.content.name
            };
        } else if (message.idents === 'stdout' || message.idents === 'stream.stdout' || message.content.name === 'stdout') {
            result = {
                data: {
                    'text/plain': (ref1 = message.content.text) != null ? ref1 : message.content.data
                },
                type: 'text',
                stream: 'stdout'
            };
        } else if (message.idents === 'stderr' || message.idents === 'stream.stderr' || message.content.name === 'stderr') {
            result = {
                data: {
                    'text/plain': (ref2 = message.content.text) != null ? ref2 : message.content.data
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