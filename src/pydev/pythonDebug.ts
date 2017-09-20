"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
	Logger, logger,
	DebugSession, LoggingDebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent,
	Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { PydevDebugger, Command } from './pydevDebugger';
import { parseString } from 'xml2js';

function logArgsToString(args: any[]): string {
	return args.map(arg => {
		return typeof arg === 'string' ?
			arg :
			JSON.stringify(arg);
	}).join(' ');
}

export function verbose(...args: any[]) {
	logger.verbose(logArgsToString(args));
}

export function log(...args: any[]) {
	logger.log(logArgsToString(args));
}

export function logError(...args: any[]) {
	logger.error(logArgsToString(args));
}

// This interface should always match the schema found in `package.json`.
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	program: string;
	stopOnEntry?: boolean;
	args?: string[];
	showLog?: boolean;
	cwd?: string;
	env?: { [key: string]: string; };
	mode?: string;
	remotePath?: string;
	port?: number;
	host?: string;
	buildFlags?: string;
	init?: string;
	trace?: boolean | 'verbose';
	/** Optional path to .env file. */
	envFile?: string;
	backend?: string;
}

interface DebuggerState {
	exited: boolean;
	exitStatus: number;
	breakPoint: DebugBreakpoint;
	breakPointInfo: {};
	breakpointId: number;
	currentThread: DebugThread;
}

interface DebugBreakpoint {
	addr: number;
	continue: boolean;
	file: string;
	functionName?: string;
	id: number;
	line: number;
	stacktrace: number;
	variables?: DebugVariable[];
}

interface DebugThread {
	file: string;
	id: number;
	line: number;
	pc: number;
	function?: DebugFunction;
};

interface DebugLocation {
	pc: number;
	file: string;
	line: number;
	function: DebugFunction;
}

interface DebugFunction {
	name: string;
	value: number;
	type: number;
	goType: number;
	args: DebugVariable[];
	locals: DebugVariable[];
}

interface DebugVariable {
	name: string;
	addr: number;
	type: string;
	realType: string;
	value: string;
	len: number;
	cap: number;
	children: DebugVariable[];
	unreadable: string;
}

class PythonDebugSession extends LoggingDebugSession {

	private _variableHandles: Handles<DebugVariable>;
	private breakpoints: Map<string, DebugBreakpoint[]>;
	private threads: Set<number>;
	private debugState: DebuggerState;
	private pydevd: PydevDebugger;

	private launchArgs: LaunchRequestArguments;

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor() {
		super("mock-debug.txt");

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);

		this._variableHandles = new Handles<DebugVariable>();
		this.threads = new Set<number>();
		this.debugState = null;
		this.pydevd = null;
		this.breakpoints = new Map<string, DebugBreakpoint[]>();
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		verbose('InitializeRequest');
		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());

		this.debugState = {
			exited: false,
			exitStatus: null,
			breakPoint: null,
			breakPointInfo: {},
			breakpointId: 0,
			currentThread: null
		};

		response.body = response.body || {};
		response.body.supportsConfigurationDoneRequest = true; // This debug adapter implements the configurationDoneRequest.
		response.body.supportsEvaluateForHovers = true;	// make VS Code to use 'evaluate' when hovering over source
		response.body.supportsStepBack = false; // Pydev does not support 'step back'

		this.sendResponse(response);
		verbose('InitializeResponse');
	}

	/**
	 * MUST create a new pydevd instance.
	 */
	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		this.launchArgs = args;

		let port = args.port || 0; // Autoset the port number by default.
		let host = args.host || '127.0.0.1';

		this.pydevd = new PydevDebugger(port, host, args.program, args);
		this.pydevd.on('call', (command: Command, sequence: number, args) => {
			this.handleEvent(command, sequence, args, response);
		});
		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_RUN);
		})

		// make sure to 'Stop' the buffered logging if 'trace' is not set
		// logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);

		logger.setup(Logger.LogLevel.Verbose, false);
	}

	private handleEvent(command: Command, sequence: number, args: [any], response: DebugProtocol.LaunchResponse) {
		// Handle aribitrary commands
		let handlers: Map<Command, (args: [any], response: DebugProtocol.LaunchResponse) => void> = new Map([
			[Command.CMD_THREAD_SUSPEND, this.handleThreadSuspend],
			[Command.CMD_ERROR, this.handleDebuggerError]
		]);

		if (handlers.has(command)) {
			handlers[command](args, response);
		}
	}

	private handleThreadSuspend(args: [string],response: DebugProtocol.LaunchResponse) {

		parseString(args[0], (err, result) => {
			this.sendEvent(new StoppedEvent('The thread has stopped', 0));
		});
	}

	private handleDebuggerError(args: [string], response: DebugProtocol.LaunchResponse) {
	
		this.sendErrorResponse(response, 3000);
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		verbose('SetBreakPointsRequest');
		if (!this.breakpoints.get(args.source.path)) {
			this.breakpoints.set(args.source.path, []);
		}
		// breakpoint_id, 'python-line', self.get_main_filename(), line, func)
		let file = args.source.path;
		Promise.all(this.breakpoints.get(file).map(existingBP => {
			verbose('Clearing: ' + existingBP.id);
			this.pydevd.call(Command.CMD_REMOVE_BREAK, ['python-line', args.source.path, existingBP.id]);
		})).then(() => {
			verbose('All cleared')
			return Promise.all(args.lines.map(line => {
				verbose('Creating on: ' + file + ':' + line);

				this.debugState.breakpointId++;
				this.pydevd.call(Command.CMD_SET_BREAK, [this.debugState.breakpointId, 'python-line', file, line, 'None', 'None', 'None']);
			}));
		}).then(() => {
			let breakpoints = args.lines.map(line => {
				return { verified: false, line: line };
			})

			response.body = { breakpoints };
			this.sendResponse(response);
			verbose('SetBreakPointsResponse');
		});
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_LIST_THREADS).then(function ([command, sequence, args]: [Command, number, Array<string>]) {
				//
				//
			});
		});

		this.sendResponse(response);
	}

	/**
	 * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
	 */
	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {

		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {

		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {

		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_RUN);
		});

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {

		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_STEP_OVER);
		});

		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse): void {

		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_STEP_INTO);
		});
		this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse): void {

		this.pydevd.server.then(() => {
			this.pydevd.call(Command.CMD_STEP_RETURN);
		});
		this.sendResponse(response);
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {

		this.sendResponse(response);
	}

}

DebugSession.run(PythonDebugSession);
