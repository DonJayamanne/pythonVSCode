import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as services from './jupyter-js-services-shim';
import {Kernel} from './kernel';

export class WSKernel extends Kernel {
    constructor(kernelSpec, language: string, private session: any) {
        super(kernelSpec, language);

        this.session.statusChanged.connect((function (_this) {
            return function () {
                return _this._onStatusChange();
            };
        })(this));
        this._onStatusChange();
    }

    public interrupt() {
        return this.session.kernel.interrupt();
    };

    public shutdown() {
        return this.session.kernel.shutdown();
    };

    public restart() {
        return this.session.kernel.restart();
    };

    public _onStatusChange() {
        // return this.statusView.setStatus(this.session.status);
        this.statusBar.text = `Sesion Status = ${this.session.status}`;
    };

    public _execute(code, onResults, callWatches) {
        var future;
        future = this.session.kernel.execute({
            code: code
        });
        future.onIOPub = (function (_this) {
            return function (message) {
                var result;
                if (callWatches && message.header.msg_type === 'status' && message.content.execution_state === 'idle') {
                    _this._callWatchCallbacks();
                }
                if (onResults != null) {
                    console.log('WSKernel: _execute:', message);
                    result = _this._parseIOMessage(message);
                    if (result != null) {
                        return onResults(result);
                    }
                }
            };
        })(this);
        future.onReply = function (message) {
            var result;
            if (message.content.status === 'error') {
                return;
            }
            result = {
                data: 'ok',
                type: 'text',
                stream: 'status'
            };
            return typeof onResults === "function" ? onResults(result) : void 0;
        };
        return future.onStdin = (function (_this) {
            return function (message) {
                var inputView, prompt;
                if (message.header.msg_type !== 'input_request') {
                    return;
                }
                prompt = message.content.prompt;
                throw new Error('Oops');
                // inputView = new InputView(prompt, function (input) {
                //     return _this.session.kernel.sendInputReply({
                //         value: input
                //     });
                // });
                // return inputView.attach();
            };
        })(this);
    };

    public execute(code, onResults) {
        return this._execute(code, onResults, true);
    };

    public executeWatch(code, onResults) {
        return this._execute(code, onResults, false);
    };

    public complete(code, onResults) {
        return this.session.kernel.complete({
            code: code,
            cursor_pos: code.length
        }).then(function (message) {
            return typeof onResults === "function" ? onResults(message.content) : void 0;
        });
    };

    public inspect(code, cursor_pos, onResults) {
        return this.session.kernel.inspect({
            code: code,
            cursor_pos: cursor_pos,
            detail_level: 0
        }).then(function (message) {
            return typeof onResults === "function" ? onResults({
                data: message.content.data,
                found: message.content.found
            }) : void 0;
        });
    };

    public promptRename() {
        throw new Error('promptRename');
        // var view;
        // view = new RenameView('Name your current session', this.session.path, (function (_this) {
        //     return function (input) {
        //         return _this.session.rename(input);
        //     };
        // })(this));
        // return view.attach();
    };

    public destroy() {
        console.log('WSKernel: destroying jupyter-js-services Session');
        this.session.dispose();
        return super.destroy();
    };
}