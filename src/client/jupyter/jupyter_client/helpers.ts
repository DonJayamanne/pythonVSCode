import { EventEmitter } from 'events';
import { JupyterMessage, ParsedIOMessage } from '../contracts';

export class Helpers extends EventEmitter {
    constructor() {
        super();
    }

    private onShellMessage(message: JupyterMessage) {
        // let callback: Function;
        // if (!this.isValidMessag(message)) {
        //     return;
        // }
        // const msg_id = message.parent_header.msg_id;
        // if (msg_id != null && this.executionCallbacks.has(msg_id)) {
        //     callback = this.executionCallbacks.get(msg_id);
        // }
        // if (!callback) {
        //     return;
        // }
        // const status = message.content.status;
        // if (status === 'error') {
        //     const msg_type = message.header.msg_type;
        //     // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
        //     if (msg_type === 'execution_reply' || msg_type === 'execute_reply') {
        //         this.executionCallbacks.delete(msg_id);
        //         return callback({
        //             data: 'error',
        //             type: 'text',
        //             stream: 'status'
        //         });
        //     }
        //     return;
        // }
        // if (status === 'ok') {
        //     const msg_type = message.header.msg_type;
        //     // http://jupyter-client.readthedocs.io/en/latest/messaging.html#request-reply
        //     if (msg_type === 'execution_reply' || msg_type === 'execute_reply') {
        //         this.executionCallbacks.delete(msg_id);
        //         return callback({
        //             data: 'ok',
        //             type: 'text',
        //             stream: 'status'
        //         });
        //     } else if (msg_type === 'complete_reply') {
        //         return callback(message.content);
        //     } else if (msg_type === 'inspect_reply') {
        //         return callback({
        //             data: message.content.data,
        //             found: message.content.found
        //         });
        //     } else {
        //         this.executionCallbacks.delete(msg_id);
        //         return callback({
        //             data: 'ok',
        //             type: 'text',
        //             stream: 'status'
        //         });
        //     }
        // }
    };


    public parseIOMessage(message: JupyterMessage): ParsedIOMessage {
        if (!this.isValidMessag(message)) {
            return;
        }
        const msg_type = message.header.msg_type;
        if (msg_type === 'status') {
            this.emit('status', message.content.execution_state);
        }
        const msg_id = message.parent_header.msg_id;
        if (!msg_id) {
            return;
        }
        return this._parseIOMessage(message);
    };

    public isValidMessag(message: JupyterMessage) {
        if (!message) {
            return false;
        }
        if (!message.content) {
            return false;
        }
        if (message.content.execution_state === 'starting') {
            return false;
        }
        if (!message.parent_header) {
            return false;
        }
        if (typeof message.parent_header.msg_id !== 'string') {
            return false;
        }
        if (typeof message.parent_header.msg_type !== 'string') {
            return false;
        }
        if (!message.header) {
            return false;
        }
        if (typeof message.header.msg_id !== 'string') {
            return false;
        }
        if (typeof message.header.msg_type !== 'string') {
            return false;
        }
        return true;
    };

    private _parseIOMessage(message: JupyterMessage): ParsedIOMessage {
        let result = this._parseDisplayIOMessage(message);
        if (!result) {
            result = this._parseResultIOMessage(message);
        }
        if (!result) {
            result = this._parseErrorIOMessage(message);
        }
        if (!result) {
            result = this._parseStreamIOMessage(message);
        }
        return result;
    }

    private _parseDisplayIOMessage(message): ParsedIOMessage {
        if (message.header.msg_type === 'display_data') {
            return this._parseDataMime(message.content.data);
        }
        return;
    }

    private _parseResultIOMessage(message): ParsedIOMessage {
        const msg_type = message.header.msg_type;
        if (msg_type === 'execute_result' || msg_type === 'pyout') {
            return this._parseDataMime(message.content.data);
        }
        return null;
    }

    private _parseDataMime(data): ParsedIOMessage {
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
    }

    private _getMimeType(data): string {
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
    }

    private _parseErrorIOMessage(message): ParsedIOMessage {
        const msg_type = message.header.msg_type;
        if (msg_type === 'error' || msg_type === 'pyerr') {
            return this._parseErrorMessage(message);
        }
        return null;
    }

    private _parseErrorMessage(message): ParsedIOMessage {
        let errorString: string;
        const ename = message.content.ename != null ? message.content.ename : '';
        const evalue = message.content.evalue != null ? message.content.evalue : '';
        const errorMessage = ename + ': ' + evalue;
        errorString = errorMessage;
        try {
            errorString = message.content.traceback.join('\n');
        } catch (err) {
        }
        return {
            data: {
                'text/plain': errorString,
            },
            message: errorMessage,
            type: 'text',
            stream: 'error'
        };
    }

    private _parseStreamIOMessage(message): ParsedIOMessage {
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
    }
}