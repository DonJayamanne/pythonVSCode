// var _, child_process, fs, jmp, path, uuid, zmq,
//     hasProp = {}.hasOwnProperty;
// let InputView;
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {Kernel} from './kernel';
import * as vscode from 'vscode';
const _ = require('lodash');
const jmp = require('jmp');
const uuid = require('uuid');
const zmq = jmp.zmq;

// InputView = require('./input-view');

export class ZMQKernel extends Kernel {
    private executionCallbacks: any;
    constructor(kernelSpec, grammar, private connection, private connectionFile, private kernelProcess?) {
        super(kernelSpec, grammar);
        var getKernelNotificationsRegExp;
        this.executionCallbacks = {};
        this._connect();
        if (this.kernelProcess != null) {
            console.log('ZMQKernel: @kernelProcess:', this.kernelProcess);
            getKernelNotificationsRegExp = function () {
                var err, flags, pattern;
                try {
                    // pattern = atom.config.get('Hydrogen.kernelNotifications');
                    pattern = '(?!)';
                    flags = 'im';
                    return new RegExp(pattern, flags);
                } catch (_error) {
                    err = _error;
                    return null;
                }
            };
            this.kernelProcess.stdout.on('data', (function (_this) {
                return function (data) {
                    var regexp;
                    data = data.toString();
                    console.log('ZMQKernel: stdout:', data);
                    regexp = getKernelNotificationsRegExp();
                    if (regexp != null ? regexp.test(data) : void 0) {
                        return vscode.window.showInformationMessage(data);
                        // return atom.notifications.addInfo(_this.kernelSpec.display_name, {
                        //     description: data,
                        //     dismissable: true
                        // });
                    }
                };
            })(this));
            this.kernelProcess.stderr.on('data', (function (_this) {
                return function (data) {
                    var regexp;
                    data = data.toString();
                    console.log('ZMQKernel: stderr:', data);
                    regexp = getKernelNotificationsRegExp();
                    if (regexp != null ? regexp.test(data) : void 0) {
                        return vscode.window.showErrorMessage(data);
                        // return atom.notifications.addError(_this.kernelSpec.display_name, {
                        //     description: data,
                        //     dismissable: true
                        // });
                    }
                };
            })(this));
        } else {
            console.log('ZMQKernel: connectionFile:', this.connectionFile);
            // atom.notifications.addInfo('Using an existing kernel connection');
            vscode.window.showInformationMessage('Using an existing kernel connection')
        }
    }

    private shellSocket: any;
    private controlSocket: any;
    private shellSocstdinSocketket: any;
    private stdinSocket: any;
    private ioSocket: any;
    public _connect() {
        var address, err, id, key, scheme;
        scheme = this.connection.signature_scheme.slice('hmac-'.length);
        key = this.connection.key;
        this.shellSocket = new jmp.Socket('dealer', scheme, key);
        this.controlSocket = new jmp.Socket('dealer', scheme, key);
        this.stdinSocket = new jmp.Socket('dealer', scheme, key);
        this.ioSocket = new jmp.Socket('sub', scheme, key);
        id = uuid.v4();
        this.shellSocket.identity = 'dealer' + id;
        this.controlSocket.identity = 'control' + id;
        this.stdinSocket.identity = 'dealer' + id;
        this.ioSocket.identity = 'sub' + id;
        address = this.connection.transport + "://" + this.connection.ip + ":";
        this.shellSocket.connect(address + this.connection.shell_port);
        this.controlSocket.connect(address + this.connection.control_port);
        this.ioSocket.connect(address + this.connection.iopub_port);
        this.ioSocket.subscribe('');
        this.stdinSocket.connect(address + this.connection.stdin_port);
        this.shellSocket.on('message', this.onShellMessage.bind(this));
        this.ioSocket.on('message', this.onIOMessage.bind(this));
        this.stdinSocket.on('message', this.onStdinMessage.bind(this));
        this.shellSocket.on('connect', function () {
            return console.log('shellSocket connected');
        });
        this.controlSocket.on('connect', function () {
            return console.log('controlSocket connected');
        });
        this.ioSocket.on('connect', function () {
            return console.log('ioSocket connected');
        });
        this.stdinSocket.on('connect', function () {
            return console.log('stdinSocket connected');
        });
        try {
            this.shellSocket.monitor();
            this.controlSocket.monitor();
            this.ioSocket.monitor();
            return this.stdinSocket.monitor();
        } catch (_error) {
            err = _error;
            return console.error('Kernel:', err);
        }
    };

    public interrupt() {
        if (this.kernelProcess != null) {
            console.log('ZMQKernel: sending SIGINT');
            return this.kernelProcess.kill('SIGINT');
        } else {
            console.log('ZMQKernel: cannot interrupt an existing kernel');
            // return atom.notifications.addWarning('Cannot interrupt this kernel');
            return vscode.window.showWarningMessage('Cannot interrupt this kernel');
        }
    };

    public _kill() {
        if (this.kernelProcess != null) {
            console.log('ZMQKernel: sending SIGKILL');
            return this.kernelProcess.kill('SIGKILL');
        } else {
            console.log('ZMQKernel: cannot kill an existing kernel');
            // return atom.notifications.addWarning('Cannot kill this kernel');
            return vscode.window.showWarningMessage('Cannot kill this kernel');
        }
    };

    public shutdown(restart?: boolean) {
        var message, requestId;
        if (restart == null) {
            restart = false;
        }
        requestId = 'shutdown_' + uuid.v4();
        message = this._createMessage('shutdown_request', requestId);
        message.content = {
            restart: restart
        };
        return this.shellSocket.send(new jmp.Message(message));
    };

    public _execute(code, requestId, onResults) {
        var message;
        message = this._createMessage('execute_request', requestId);
        message.content = {
            code: code,
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: true
        };
        this.executionCallbacks[requestId] = onResults;
        return this.shellSocket.send(new jmp.Message(message));
    };

    public execute(code, onResults) {
        var requestId;
        console.log('Kernel.execute:', code);
        requestId = 'execute_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public executeWatch(code, onResults) {
        var requestId;
        console.log('Kernel.executeWatch:', code);
        requestId = 'watch_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public complete(code, onResults) {
        var message, requestId;
        console.log('Kernel.complete:', code);
        requestId = 'complete_' + uuid.v4();
        message = this._createMessage('complete_request', requestId);
        message.content = {
            code: code,
            text: code,
            line: code,
            cursor_pos: code.length
        };
        this.executionCallbacks[requestId] = onResults;
        return this.shellSocket.send(new jmp.Message(message));
    };

    public inspect(code, cursor_pos, onResults) {
        var message, requestId;
        console.log('Kernel.inspect:', code, cursor_pos);
        requestId = 'inspect_' + uuid.v4();
        message = this._createMessage('inspect_request', requestId);
        message.content = {
            code: code,
            cursor_pos: cursor_pos,
            detail_level: 0
        };
        this.executionCallbacks[requestId] = onResults;
        return this.shellSocket.send(new jmp.Message(message));
    };

    public inputReply(input) {
        var message, requestId;
        requestId = 'input_reply_' + uuid.v4();
        message = this._createMessage('input_reply', requestId);
        message.content = {
            value: input
        };
        return this.stdinSocket.send(new jmp.Message(message));
    };

    public onShellMessage(message) {
        var callback, msg_id, msg_type, status;
        console.log('shell message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        msg_id = message.parent_header.msg_id;
        if (msg_id != null) {
            callback = this.executionCallbacks[msg_id];
        }
        if (callback == null) {
            return;
        }
        status = message.content.status;
        if (status === 'error') {
            return;
        }
        if (status === 'ok') {
            msg_type = message.header.msg_type;
            if (msg_type === 'execution_reply') {
                return callback({
                    data: 'ok',
                    type: 'text',
                    stream: 'status'
                });
            } else if (msg_type === 'complete_reply') {
                return callback(message.content);
            } else if (msg_type === 'inspect_reply') {
                return callback({
                    data: message.content.data,
                    found: message.content.found
                });
            } else {
                return callback({
                    data: 'ok',
                    type: 'text',
                    stream: 'status'
                });
            }
        }
    };

    public onStdinMessage(message) {
        var inputView, msg_type, prompt;
        console.log('stdin message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        msg_type = message.header.msg_type;
        if (msg_type === 'input_request') {
            throw new Error('Oops');
            // prompt = message.content.prompt;
            // inputView = new InputView(prompt, (function (_this) {
            //     return function (input) {
            //         return _this.inputReply(input);
            //     };
            // })(this));
            // return inputView.attach();
        }
    };

    public onIOMessage(message) {
        var callback, msg_id, msg_type, ref, result, status;
        console.log('IO message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        msg_type = message.header.msg_type;
        if (msg_type === 'status') {
            status = message.content.execution_state;
            // this.statusView.setStatus(status);
            this.statusBar.text = status;
            msg_id = (ref = message.parent_header) != null ? ref.msg_id : void 0;
            if (status === 'idle' && (msg_id != null ? msg_id.startsWith('execute') : void 0)) {
                this._callWatchCallbacks();
            }
        }
        msg_id = message.parent_header.msg_id;
        if (msg_id != null) {
            callback = this.executionCallbacks[msg_id];
        }
        if (callback == null) {
            return;
        }
        result = this._parseIOMessage(message);
        if (result != null) {
            return callback(result);
        }
    };

    public _isValidMessage(message) {
        if (message == null) {
            console.log('Invalid message: null');
            return false;
        }
        if (message.content == null) {
            console.log('Invalid message: Missing content');
            return false;
        }
        if (message.content.execution_state === 'starting') {
            console.log('Dropped starting status IO message');
            return false;
        }
        if (message.parent_header == null) {
            console.log('Invalid message: Missing parent_header');
            return false;
        }
        if (message.parent_header.msg_id == null) {
            console.log('Invalid message: Missing parent_header.msg_id');
            return false;
        }
        if (message.parent_header.msg_type == null) {
            console.log('Invalid message: Missing parent_header.msg_type');
            return false;
        }
        if (message.header == null) {
            console.log('Invalid message: Missing header');
            return false;
        }
        if (message.header.msg_id == null) {
            console.log('Invalid message: Missing header.msg_id');
            return false;
        }
        if (message.header.msg_type == null) {
            console.log('Invalid message: Missing header.msg_type');
            return false;
        }
        return true;
    };

    public destroy() {
        console.log('ZMQKernel: destroy:', this);
        this.shutdown();
        if (this.kernelProcess != null) {
            this._kill();
            fs.unlink(this.connectionFile);
        }
        this.shellSocket.close();
        this.controlSocket.close();
        this.ioSocket.close();
        this.stdinSocket.close();
        return super.destroy.apply(this, arguments);
    };

    public _getUsername() {
        return process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
    };

    public _createMessage(msg_type, msg_id) {
        var message;
        if (msg_id == null) {
            msg_id = uuid.v4();
        }
        message = {
            header: {
                username: this._getUsername(),
                session: '00000000-0000-0000-0000-000000000000',
                msg_type: msg_type,
                msg_id: msg_id,
                date: new Date(),
                version: '5.0'
            },
            metadata: {},
            parent_header: {},
            content: {}
        };
        return message;
    };
}