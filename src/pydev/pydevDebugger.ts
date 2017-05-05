
import { spawn, ChildProcess } from 'child_process';
import { Server } from './server';
import { LaunchRequestArguments, verbose } from './pythonDebug';
import { EventEmitter } from 'events';

/*
    pydevd - a debugging daemon
    This is the daemon you launch for python remote debugging.
    Protocol:
    each command has a format:
        id\tsequence-num\ttext
        id: protocol command number
        sequence-num: each request has a sequence number. Sequence numbers
        originating at the debugger are odd, sequence numbers originating
        at the daemon are even. Every response uses the same sequence number
        as the request.
        payload: it is protocol dependent. When response is a complex structure, it
        is returned as XML. Each attribute value is urlencoded, and then the whole
        payload is urlencoded again to prevent stray characters corrupting protocol/xml encodings
        Commands:
        NUMBER   NAME                     FROM*     ARGUMENTS                     RESPONSE      NOTE
    100 series: program execution
        101      RUN                      JAVA      -                             -
        102      LIST_THREADS             JAVA                                    RETURN with XML listing of all threads
        103      THREAD_CREATE            PYDB      -                             XML with thread information
        104      THREAD_KILL              JAVA      id (or * to exit)             kills the thread
                                          PYDB      id                            nofies JAVA that thread was killed
        105      THREAD_SUSPEND           JAVA      XML of the stack,             suspends the thread
                                                    reason for suspension
                                          PYDB      id                            notifies JAVA that thread was suspended
        106      CMD_THREAD_RUN           JAVA      id                            resume the thread
                                          PYDB      id \t reason                  notifies JAVA that thread was resumed
        107      STEP_INTO                JAVA      thread_id
        108      STEP_OVER                JAVA      thread_id
        109      STEP_RETURN              JAVA      thread_id
        110      GET_VARIABLE             JAVA      thread_id \t frame_id \t      GET_VARIABLE with XML of var content
                                                    FRAME|GLOBAL \t attributes*
        111      SET_BREAK                JAVA      file/line of the breakpoint
        112      REMOVE_BREAK             JAVA      file/line of the return
        113      CMD_EVALUATE_EXPRESSION  JAVA      expression                    result of evaluating the expression
        114      CMD_GET_FRAME            JAVA                                    request for frame contents
        115      CMD_EXEC_EXPRESSION      JAVA
        116      CMD_WRITE_TO_CONSOLE     PYDB
        117      CMD_CHANGE_VARIABLE
        118      CMD_RUN_TO_LINE
        119      CMD_RELOAD_CODE
        120      CMD_GET_COMPLETIONS      JAVA
    500 series diagnostics/ok
        501      VERSION                  either      Version string (1.0)        Currently just used at startup
        502      RETURN                   either      Depends on caller    -
    900 series: errors
        901      ERROR                    either      -                           This is reserved for unexpected errors.
        * JAVA - remote debugger, the java end
        * PYDB - pydevd, the python end
*/

export enum Command {
	CMD_RUN = 101,
	CMD_LIST_THREADS = 102,
	CMD_THREAD_CREATE = 103,
	CMD_THREAD_KILL = 104,
	CMD_THREAD_SUSPEND = 105,
	CMD_THREAD_RUN = 106,
	CMD_STEP_INTO = 107,
	CMD_STEP_OVER = 108,
	CMD_STEP_RETURN = 109,
	CMD_GET_VARIABLE = 110,
	CMD_SET_BREAK = 111,
	CMD_REMOVE_BREAK = 112,
	CMD_EVALUATE_EXPRESSION = 113,
	CMD_GET_FRAME = 114,
	CMD_EXEC_EXPRESSION = 115,
	CMD_WRITE_TO_CONSOLE = 116,
	CMD_CHANGE_VARIABLE = 117,
	CMD_RUN_TO_LINE = 118,
	CMD_RELOAD_CODE = 119,
	CMD_GET_COMPLETIONS = 120,

	CMD_CONSOLE_EXEC = 121,
	CMD_ADD_EXCEPTION_BREAK = 122,
	CMD_REMOVE_EXCEPTION_BREAK = 123,
	CMD_LOAD_SOURCE = 124,
	CMD_ADD_DJANGO_EXCEPTION_BREAK = 125,
	CMD_REMOVE_DJANGO_EXCEPTION_BREAK = 126,
	CMD_SET_NEXT_STATEMENT = 127,
	CMD_SMART_STEP_INTO = 128,
	CMD_EXIT = 129,
	CMD_SIGNATURE_CALL_TRACE = 130,
	CMD_SET_PY_EXCEPTION = 131,
	CMD_GET_FILE_CONTENTS = 132,
	CMD_SET_PROPERTY_TRACE = 133,

	// Pydev debug console commands
	CMD_EVALUATE_CONSOLE_EXPRESSION = 134,
	CMD_RUN_CUSTOM_OPERATION = 135,
	CMD_GET_BREAKPOINT_EXCEPTION = 136,
	CMD_STEP_CAUGHT_EXCEPTION = 137,
	CMD_SEND_CURR_EXCEPTION_TRACE = 138,
	CMD_SEND_CURR_EXCEPTION_TRACE_PROCEEDED = 139,
	CMD_IGNORE_THROWN_EXCEPTION_AT = 140,
	CMD_ENABLE_DONT_TRACE = 141,
	CMD_SHOW_CONSOLE = 142,

	CMD_GET_ARRAY = 143,
	CMD_STEP_INTO_MY_CODE = 144,
	CMD_GET_CONCURRENCY_EVENT = 145,

	CMD_VERSION = 501,
	CMD_RETURN = 502,
	CMD_ERROR = 901,
};

// TODO: match sequences with promise callback

export class PydevDebugger extends EventEmitter {
	program: string;
	debugProcess: ChildProcess;
	server: Server;
	onstdout: (str: string) => void;
	onstderr: (str: string) => void;
	onclose: (code: number) => void;

	private sequence: number = 0;
	private sequences: Map<number, Function>;

	constructor(port: number, host: string, program: string, launchArgs: LaunchRequestArguments) {
		super();

		let that = this;
		this.program = program;

		this.server = new Server(port);
		this.server.on('message', msg => {
			verbose('Debugger received message: ' + msg);

			let args = msg.split('\t');
			let command: Command = args[0];
			let sequence: number = parseInt(args[1]);

			if (this.sequences.has(sequence)) {
				this.sequences[sequence](command, sequence, args.slice(2)); // Resolve the promise
				this.sequences.delete(sequence); // Cleanup memory
			}

			that.emit('call', command, sequence, args.slice(2));
		});
		this.server.on('connect', function () {
			let args = [
				'--DEBUG_RECORD_SOCKET_READS',
				'--qt-support',
				'--client',
				host,
				'--port',
				that.server.port.toString(),
				'--file',
				program
			];
			let env = {};

			this.debugProcess = spawn('pydevd', args, { env });
			this.debugProcess.stderr.on('data', chunk => {
				let str = chunk.toString();
				if (this.onstderr) { this.onstderr(str); }
			});
			this.debugProcess.stdout.on('data', chunk => {
				let str = chunk.toString();
				if (this.onstdout) { this.onstdout(str); }
			});
			this.debugProcess.on('close', (code) => { });
			this.debugProcess.on('error', function (err) { });
		});
	}

	public start() {
		this.server.listen();
	}

	public call(command: Command, args: any[] = []): Promise<any> {
		let sequence = this.nextSequence();
		let msg: string = [command.toString(), sequence.toString()].concat(args).join("\t");
		verbose('Debugger sent message: ' + msg);
		this.server.Write(msg);

		return new Promise(resolve => {
			this.sequences[sequence] = resolve;
		});
	}

	/* Book-keeping methods */

	private nextSequence(): number {
		this.sequence += 2;
		return this.sequence;
	}
}
