import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {Kernel} from './kernel';
import * as vscode from 'vscode';
const jmp = require('jmp');
const uuid = require('uuid');
const zmq = jmp.zmq;

export class ZMQKernel extends Kernel {
    private executionCallbacks: any;
    constructor(kernelSpec, language: string, private connection, private connectionFile, public kernelProcess?) {
        super(kernelSpec, language);
        let getKernelNotificationsRegExp: Function;
        this.executionCallbacks = {};
        this._connect();
        if (this.kernelProcess != null) {
            console.log('ZMQKernel: @kernelProcess:', this.kernelProcess);
            getKernelNotificationsRegExp = function () {
                try {
                    // pattern = atom.config.get('Hydrogen.kernelNotifications');
                    const pattern = '(?!)';
                    const flags = 'im';
                    return new RegExp(pattern, flags);
                } catch (_error) {
                    return null;
                }
            };
            this.kernelProcess.stdout.on('data', (function (_this) {
                return function (data) {
                    data = data.toString();
                    console.log('ZMQKernel: stdout:', data);
                    const regexp = getKernelNotificationsRegExp();
                    if (regexp != null ? regexp.test(data) : null) {
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
                    data = data.toString();
                    console.log('ZMQKernel: stderr:', data);
                    const regexp = getKernelNotificationsRegExp();
                    if (regexp !== null ? regexp.test(data) : null) {
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
        const scheme = this.connection.signature_scheme.slice('hmac-'.length);
        const key = this.connection.key;
        this.shellSocket = new jmp.Socket('dealer', scheme, key);
        this.controlSocket = new jmp.Socket('dealer', scheme, key);
        this.stdinSocket = new jmp.Socket('dealer', scheme, key);
        this.ioSocket = new jmp.Socket('sub', scheme, key);
        const id = uuid.v4();
        this.shellSocket.identity = 'dealer' + id;
        this.controlSocket.identity = 'control' + id;
        this.stdinSocket.identity = 'dealer' + id;
        this.ioSocket.identity = 'sub' + id;
        const address = this.connection.transport + "://" + this.connection.ip + ":";
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
            return console.error('Kernel:', _error);
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
        if (restart == null) {
            restart = false;
        }
        const requestId = 'shutdown_' + uuid.v4();
        const message = this._createMessage('shutdown_request', requestId);
        message.content = {
            restart: restart
        };
        return this.shellSocket.send(new jmp.Message(message));
    };

    public _execute(code, requestId, onResults) {
        const message = this._createMessage('execute_request', requestId);
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
        console.log('Kernel.execute:', code);
        const requestId = 'execute_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public executeWatch(code, onResults) {
        console.log('Kernel.executeWatch:', code);
        const requestId = 'watch_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public complete(code, onResults) {
        console.log('Kernel.complete:', code);
        const requestId = 'complete_' + uuid.v4();
        const message = this._createMessage('complete_request', requestId);
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
        console.log('Kernel.inspect:', code, cursor_pos);
        const requestId = 'inspect_' + uuid.v4();
        const message = this._createMessage('inspect_request', requestId);
        message.content = {
            code: code,
            cursor_pos: cursor_pos,
            detail_level: 0
        };
        this.executionCallbacks[requestId] = onResults;
        return this.shellSocket.send(new jmp.Message(message));
    };

    public inputReply(input) {
        const requestId = 'input_reply_' + uuid.v4();
        const message = this._createMessage('input_reply', requestId);
        message.content = {
            value: input
        };
        return this.stdinSocket.send(new jmp.Message(message));
    };

    public onShellMessage(message) {
        let callback: Function;
        console.log('shell message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_id = message.parent_header.msg_id;
        if (msg_id != null) {
            callback = this.executionCallbacks[msg_id];
        }
        if (callback == null) {
            return;
        }
        const status = message.content.status;
        if (status === 'error') {
            return;
        }
        if (status === 'ok') {
            const msg_type = message.header.msg_type;
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
        console.log('stdin message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_type = message.header.msg_type;
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
        let callback: Function;
        let msg_id;
        console.log('IO message:', message);
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_type = message.header.msg_type;
        if (msg_type === 'status') {
            const status = message.content.execution_state;
            // this.statusView.setStatus(status);
            this.statusBar.text = status;
            msg_id = message.parent_header !== null ? message.parent_header.msg_id : null;
            if (status === 'idle' && (msg_id !== null ? msg_id.startsWith('execute') : null)) {
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
        const result = this._parseIOMessage(message);
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
        if (msg_id == null) {
            msg_id = uuid.v4();
        }
        const message = {
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