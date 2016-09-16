import * as vscode from 'vscode';
// http://jupyter-client.readthedocs.io/en/latest/messaging.html#to-do

/**
   * The kernelspec metadata.
   */
export interface KernelspecMetadata {
    argv: string[];
    env: any;
    display_name: string;
    language: string;
}
/**
   * The kernelspec metadata.
   */
export interface Kernelspec {
    spec: KernelspecMetadata;
    resource_dir: string;
}

export interface KernelEvents {
    onStatusChange: vscode.Event<[KernelspecMetadata, string]>;
}

// export interface JupyterMessage extends Object {
//     parent_header: any;
//     content: any;
//     header: any;
// }

// http://jupyter-client.readthedocs.io/en/latest/messaging.html#general-message-format
// http://jupyter-client.readthedocs.io/en/latest/messaging.html#python-api
export interface JupyterMessage {
    // http://jupyter-client.readthedocs.io/en/latest/messaging.html#python-api
    // The msg's unique identifier and type are always stored in the header,
    // but the Python implementation copies them to the top level.
    msg_id: string;
    msg_type: 'execute_request' | 'execute_reply';
    parent_header: {
        msg_id: string
    };
    content: {
        // status = 'busy', sent back as soon as a request is received by the kernel (kind of an ACK)
        // status = 'error', then ename, evalue, traceback will be returned
        // status = 'error', then ename, evalue, traceback will be returned
        status: 'busy' | 'error' | 'ok' | 'abort';

        // ********************************************************
        // RESPONSE for status = 'error'
        // ********************************************************
        ename: string; // Exception name, as a string
        evalue: string; // Exception value, as a string
        traceback: string[]; // traceback frames as strings

        // ********************************************************
        // REQUEST for msg_type = 'execute_request'
        // ********************************************************
        // if msg_type = 'execute_request'
        // These items are sent in the request
        // Source code to be executed by the kernel, one or more lines.
        code: string;
        // A boolean flag which, if True, signals the kernel to execute
        // this code as quietly as possible.
        // silent=True forces store_history to be False,
        // and will *not*:
        //   - broadcast output on the IOPUB channel
        //   - have an execute_result
        // The default is False.
        silent: boolean;
        // A boolean flag which, if True, signals the kernel to populate history
        // The default is True if silent is False.  If silent is True, store_history
        // is forced to be False.
        store_history: boolean;
        // A dict mapping names to expressions to be evaluated in the
        // users dict. The rich display-data representation of each will be evaluated after execution.
        // See the display_data content for the structure of the representation data.
        user_expressions: any;
        // Some frontends do not support stdin requests.
        // If this is true, code running in the kernel can prompt the user for input
        // with an input_request message (see below). If it is false, the kernel
        // should not send these messages.
        allow_stdin: boolean;
        // A boolean flag, which, if True, does not abort the execution queue, if an exception is encountered.
        // This allows the queued execution of multiple execute_requests, even if they generate exceptions.
        stop_on_error: boolean;

        // ********************************************************
        // RESPONSE for msg_type = 'execute_reply'
        // ********************************************************
        // status:string (already covered above)

        // The global kernel counter that increases by one with each request that
        // stores history.  This will typically be used by clients to display
        // prompt numbers to the user.  If the request did not store history, this will
        // be the current value of the counter in the kernel.
        execution_count: number;

        // ********************************************************
        // RESPONSE for msg_type = 'execute_reply' and status === 'ok'
        // ********************************************************
        // 'payload' will be a list of payload dicts, and is optional.
        // payloads are considered deprecated.
        // The only requirement of each payload dict is that it have a 'source' key,
        // which is a string classifying the payload (e.g. 'page').
        payload: any[];
        // Results for the user_expressions.
        // user_expressions: any;


        // ********************************************************
        // REQUEST for msg_type = 'inspect_request'
        // ********************************************************
        // This is used for introspection (analysis, autocomplete, etc)
        // The code context in which introspection is requested
        // this may be up to an entire multiline cell.
        // code: string;
        // The cursor position within 'code' (in unicode characters) where inspection is requested
        cursor_pos: number;
        // The level of detail desired.  In IPython, the default (0) is equivalent to typing
        // 'x?' at the prompt, 1 is equivalent to 'x??'.
        // The difference is up to kernels, but in IPython level 1 includes the source code
        // if available.
        detail_level: number; // 1 or 0


        // ********************************************************
        // RESPONSE for msg_type = 'inspect_request'
        // ********************************************************
        // status = 'ok or status = 'error'
        // ********************************************************
        // RESPONSE for msg_type = 'inspect_request' and status = 'ok'
        // ********************************************************
        // 'ok' if the request succeeded or 'error', with error information as in all other replies.
        // status: 'ok';
        // found should be true if an object was found, false otherwise
        found: boolean;
        // data can be empty if nothing is found
        data: any;
        metadata: any;


        // ********************************************************
        // REQUEST for msg_type = 'complete_request'
        // ********************************************************
        // code: string;
        // The cursor position within 'code' (in unicode characters) where inspection is requested
        // cursor_pos: number;

        // ********************************************************
        // RESPONSE for msg_type = 'complete_reply'
        // ********************************************************
        // status = 'ok or status = 'error'
        // ********************************************************
        // RESPONSE for msg_type = 'complete_reply' and status = 'ok'
        // ********************************************************
        // The list of all matches to the completion request, such as
        // ['a.isalnum', 'a.isalpha'] for the above example.
        matches: string[];
        // The range of text that should be replaced by the above matches when a completion is accepted.
        // typically cursor_end is the same as cursor_pos in the request.
        cursor_start: number
        cursor_end: number
        // Information that frontend plugins might use for extra display information about completions.
        // metadata: any

        // ********************************************************
        // RESPONSE for msg_type = 'stream'
        // ********************************************************
        // Streams (stdout, stderr, etc)
        // The name of the stream is one of 'stdout', 'stderr'
        name: 'stdout' | 'stderr';
        // The text is an arbitrary string to be written to that stream
        text: string;

        // ********************************************************
        // RESPONSE for msg_type = 'input_request'
        // ********************************************************
        // the text to show at the prompt
        prompt: string;
        // Is the request for a password?
        // If so, the frontend shouldn't echo input.
        password: boolean;

        // ********************************************************
        // REQUEST for msg_type = 'input_reply'
        // ********************************************************
        value: string;

        // ********************************************************
        // RESPONSE for msg_type = 'status'
        // ********************************************************
        execution_state: string;
    };
    header: {
        msg_id: string, // typically UUID, must be unique per message
        username: string,
        session: string, // typically UUID, should be unique per session
        // ISO 8601 timestamp for when the message is created
        date: string,
        // All recognized message type strings are listed below.
        msg_type: string,
        // the message protocol version
        version: '5.0'
    };
}
