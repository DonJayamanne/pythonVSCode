'use strict';

import {DebugSession} from 'vscode-debugadapter';
import {IPythonProcess, IDebugServer} from '../Common/Contracts';
import {BaseDebugServer} from './BaseDebugServer';

export class NonDebugServer extends BaseDebugServer {
    constructor(debugSession: DebugSession, pythonProcess: IPythonProcess) {
        super(debugSession, pythonProcess);
    }

    public Stop() {
    }

    public Start(): Promise<IDebugServer> {
        return Promise.resolve<IDebugServer>({ port: NaN, host: null });
    }
}