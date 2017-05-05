
import { spawn, ChildProcess } from 'child_process';
import { Server } from './server';
import { LaunchRequestArguments, verbose } from './pythonDebug';
import { EventEmitter } from 'events';


export enum WriteCommand {
	Version = 501,
	MakeInitialRun = 101,
	AddBreakpoint = 111,
	AddExceptionBreakpoint = 122,
	StepOver = 108,
	StepIn = 108,
	StepReturn = 109,
	SuspendThread = 105,
	RunThread = 106,
	StepOut = 106,
	RemoveBreakpoint = 112,
};

export enum ReadCommand {
	BuildNumber = 501,
	Thread = 103,
};


export class PydevDebugger extends EventEmitter {
	program: string;
	debugProcess: ChildProcess;
	server: Server;
	onstdout: (str: string) => void;
	onstderr: (str: string) => void;
	onclose: (code: number) => void;

	private sequence: number = 0;

	constructor(port: number, host: string, program: string, launchArgs: LaunchRequestArguments) {
		super();

		let that = this;
		this.program = program;

		this.server = new Server(port);
		this.server.on('message', msg => {
			verbose('Debugger received message: ' + msg);

			let args = msg.split('\t');
			let command: ReadCommand = args[0];
			let sequence: number = parseInt(args[1]);

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
		this.server.listen();
	}

	call(command: WriteCommand, args: any[] = []) {
		let msg: string = [command.toString(), this.nextSequence().toString()].concat(args).join("\t");
		verbose('Debugger sent message: ' + msg);
		this.server.Write(msg);
	}

	/* Book-keeping methods */

	private nextSequence(): number {
		this.sequence += 2;
		return this.sequence;
	}
}
