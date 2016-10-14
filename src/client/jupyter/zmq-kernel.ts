import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Kernel } from './kernel';
import * as vscode from 'vscode';
import { KernelspecMetadata, JupyterMessage } from './contracts';
import { JmpModuleLoadError } from '../common/errors';
const uuid = require('uuid');

export class ZMQKernel extends Kernel {
    private executionCallbacks: Map<string, Function>;
    constructor(kernelSpec: KernelspecMetadata, language: string, private connection: any, private connectionFile: string, public kernelProcess?: child_process.ChildProcess) {
        super(kernelSpec, language);
        let getKernelNotificationsRegExp: Function;
        this.executionCallbacks = new Map<string, Function>();
        this._connect();
        if (this.kernelProcess != null) {
            getKernelNotificationsRegExp = () => {
                try {
                    const pattern = '(?!)';
                    const flags = 'im';
                    return new RegExp(pattern, flags);
                } catch (_error) {
                    return null;
                }
            };
            this.kernelProcess.stdout.on('data', data => {
                data = data.toString();
                const regexp = getKernelNotificationsRegExp();
                if (regexp != null ? regexp.test(data) : null) {
                    return vscode.window.showInformationMessage(data);
                }
            });
            this.kernelProcess.stderr.on('data', data => {
                data = data.toString();
                const regexp = getKernelNotificationsRegExp();
                if (regexp !== null ? regexp.test(data) : null) {
                    return vscode.window.showErrorMessage(data);
                }
            });
        } else {
            vscode.window.showInformationMessage('Using an existing kernel connection');
        }
    }

    private shellSocket: any;
    private controlSocket: any;
    private shellSocstdinSocketket: any;
    private stdinSocket: any;
    private ioSocket: any;
    private jmp: any;
    public _connect() {
        throw new Error('Support for zmq kernel has been deprecated');
    };

    public interrupt(): any {
        if (this.kernelProcess != null) {
            return this.kernelProcess.kill('SIGINT');
        } else {
            return vscode.window.showWarningMessage('Cannot interrupt this kernel');
        }
    };

    public _kill(): any {
        if (this.kernelProcess != null) {
            return this.kernelProcess.kill('SIGKILL');
        } else {
            return vscode.window.showWarningMessage('Cannot kill this kernel');
        }
    };

    public shutdown(restart?: boolean) {
        if (!this.jmp) {
            return;
        }
        if (restart == null) {
            restart = false;
        }
        const requestId = 'shutdown_' + uuid.v4();
        const message = this._createMessage('shutdown_request', requestId);
        message.content = {
            restart: restart
        };
        return this.shellSocket.send(new this.jmp.Message(message));
    };

    public _execute(code: string, requestId: string, onResults: Function) {
        const message = this._createMessage('execute_request', requestId);
        message.content = {
            code: code,
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: true
        };
        this.executionCallbacks.set(requestId, onResults);
        return this.shellSocket.send(new this.jmp.Message(message));
    };

    public execute(code: string, onResults: Function) {
        const requestId = 'execute_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public executeWatch(code: string, onResults: Function) {
        const requestId = 'watch_' + uuid.v4();
        return this._execute(code, requestId, onResults);
    };

    public complete(code: string, onResults: Function) {
        const requestId = 'complete_' + uuid.v4();
        const message = this._createMessage('complete_request', requestId);
        message.content = {
            code: code,
            text: code,
            line: code,
            cursor_pos: code.length
        };
        this.executionCallbacks.set(requestId, onResults);
        return this.shellSocket.send(new this.jmp.Message(message));
    };

    public inspect(code: string, cursor_pos, onResults: Function) {
        const requestId = 'inspect_' + uuid.v4();
        const message = this._createMessage('inspect_request', requestId);
        message.content = {
            code: code,
            cursor_pos: cursor_pos,
            detail_level: 0
        };
        this.executionCallbacks.set(requestId, onResults);
        return this.shellSocket.send(new this.jmp.Message(message));
    };

    public inputReply(input: string) {
        const requestId = 'input_reply_' + uuid.v4();
        const message = this._createMessage('input_reply', requestId);
        message.content = {
            value: input
        };
        return this.stdinSocket.send(new this.jmp.Message(message));
    };

    private onShellMessage(message: JupyterMessage) {
        let callback: Function;
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_id = message.parent_header.msg_id;
        if (msg_id != null && this.executionCallbacks.has(msg_id)) {
            callback = this.executionCallbacks.get(msg_id);
        }
        if (!callback) {
            return;
        }
        const status = message.content.status;
        if (status === 'error') {
            const msg_type = message.header.msg_type;
            // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
            if (msg_type === 'execution_reply' || msg_type === 'execute_reply') {
                this.executionCallbacks.delete(msg_id);
                return callback({
                    data: 'error',
                    type: 'text',
                    stream: 'status'
                });
            }
            return;
        }
        if (status === 'ok') {
            const msg_type = message.header.msg_type;
            // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
            if (msg_type === 'execution_reply' || msg_type === 'execute_reply') {
                this.executionCallbacks.delete(msg_id);
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
                this.executionCallbacks.delete(msg_id);
                return callback({
                    data: 'ok',
                    type: 'text',
                    stream: 'status'
                });
            }
        }
    };

    private onStdinMessage(message: JupyterMessage) {
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_type = message.header.msg_type;
        if (msg_type === 'input_request') {
            vscode.window.showInputBox({ prompt: message.content.prompt }).then(value => {
                this.inputReply(value);
            });
        }
    };

    private onIOMessage(message: JupyterMessage) {
        let callback: Function;
        let msg_id;
        if (!this._isValidMessage(message)) {
            return;
        }
        const msg_type = message.header.msg_type;
        if (msg_type === 'status') {
            const status = message.content.execution_state;
            this.raiseOnStatusChange(status);
            msg_id = message.parent_header !== null ? message.parent_header.msg_id : null;
            if (status === 'idle' && (msg_id !== null ? msg_id.startsWith('execute') : null)) {
                this._callWatchCallbacks();
            }
        }
        msg_id = message.parent_header.msg_id;
        if (msg_id != null && this.executionCallbacks.has(msg_id)) {
            callback = this.executionCallbacks.get(msg_id);
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
            return false;
        }
        if (message.content == null) {
            return false;
        }
        if (message.content.execution_state === 'starting') {
            return false;
        }
        if (message.parent_header == null) {
            return false;
        }
        if (message.parent_header.msg_id == null) {
            return false;
        }
        if (message.parent_header.msg_type == null) {
            return false;
        }
        if (message.header == null) {
            return false;
        }
        if (message.header.msg_id == null) {
            return false;
        }
        if (message.header.msg_type == null) {
            return false;
        }
        return true;
    };

    public dispose() {
        this.shutdown();
        if (this.kernelProcess != null) {
            this._kill();
            fs.unlink(this.connectionFile);
        }
        this.shellSocket.close();
        this.controlSocket.close();
        this.ioSocket.close();
        this.stdinSocket.close();
        super.dispose();
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