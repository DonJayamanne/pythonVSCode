"use strict";

import {DebugSession, OutputEvent} from "vscode-debugadapter";
import {IPythonProcess, IDebugServer} from "../Common/Contracts";
import * as net from "net";
import {EventEmitter} from "events";
import {Deferred, createDeferred} from '../../common/utils';

export abstract class BaseDebugServer extends EventEmitter {
    protected pythonProcess: IPythonProcess;
    protected debugSession: DebugSession;

    protected isRunning: boolean;
    public get IsRunning(): boolean {
        return this.isRunning;
    }
    protected debugClientConnected: Deferred<Boolean>;
    public get DebugClientConnected(): Promise<boolean> {
        return this.debugClientConnected.promise;
    }
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess) {
        super();
        this.debugSession = debugSession;
        this.pythonProcess = pythonProcess;
        this.debugClientConnected = createDeferred<Boolean>();
    }

    public abstract Start(): Promise<IDebugServer>;
    public abstract Stop();
}