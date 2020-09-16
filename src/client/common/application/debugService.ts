// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import {
    Breakpoint,
    BreakpointsChangeEvent,
    debug,
    DebugAdapterDescriptorFactory,
    DebugConfiguration,
    DebugConsole,
    DebugSession,
    DebugSessionCustomEvent,
    Disposable,
    Event,
    WorkspaceFolder
} from 'vscode';
import { noop } from '../utils/misc';
import { IDebugService } from './types';

@injectable()
export class DebugService implements IDebugService {
    public static instance = new DebugService();
    public get activeDebugConsole(): DebugConsole {
        return debug.activeDebugConsole;
    }
    public get activeDebugSession(): DebugSession | undefined {
        return debug.activeDebugSession;
    }
    public get breakpoints(): Breakpoint[] {
        return debug.breakpoints;
    }
    public get onDidChangeActiveDebugSession(): Event<DebugSession | undefined> {
        return debug.onDidChangeActiveDebugSession;
    }
    public get onDidStartDebugSession(): Event<DebugSession> {
        return debug.onDidStartDebugSession;
    }
    public get onDidReceiveDebugSessionCustomEvent(): Event<DebugSessionCustomEvent> {
        return debug.onDidReceiveDebugSessionCustomEvent;
    }
    public get onDidTerminateDebugSession(): Event<DebugSession> {
        return debug.onDidTerminateDebugSession;
    }
    public get onDidChangeBreakpoints(): Event<BreakpointsChangeEvent> {
        return debug.onDidChangeBreakpoints;
    }
    // tslint:disable-next-line:no-any
    public registerDebugConfigurationProvider(debugType: string, provider: any): Disposable {
        return debug.registerDebugConfigurationProvider(debugType, provider);
    }
    // tslint:disable-next-line:no-any
    public registerDebugAdapterTrackerFactory(debugType: string, provider: any): Disposable {
        return debug.registerDebugAdapterTrackerFactory(debugType, provider);
    }
    public startDebugging(
        folder: WorkspaceFolder | undefined,
        nameOrConfiguration: string | DebugConfiguration,
        parentSession?: DebugSession
    ): Thenable<boolean> {
        return debug.startDebugging(folder, nameOrConfiguration, parentSession);
    }
    public addBreakpoints(breakpoints: Breakpoint[]): void {
        debug.addBreakpoints(breakpoints);
    }
    public removeBreakpoints(breakpoints: Breakpoint[]): void {
        debug.removeBreakpoints(breakpoints);
    }
    public registerDebugAdapterDescriptorFactory(
        _debugType: string,
        _factory: DebugAdapterDescriptorFactory
    ): Disposable {
        // Not supported in the jupyter extension as the python extension is the only one allowed to do this.
        // tslint:disable-next-line: no-suspicious-comment
        // TODO: Do we need this in the jupyter extension?
        return { dispose: noop };
    }
}
