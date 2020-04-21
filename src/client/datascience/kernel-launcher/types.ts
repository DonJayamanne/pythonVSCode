// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

<<<<<<< HEAD
=======
import { IDisposable } from 'monaco-editor';
>>>>>>> refactorDaemon
import { Event } from 'vscode';
import { InterpreterUri } from '../../common/installer/types';
import { IAsyncDisposable } from '../../common/types';
import { IJupyterKernelSpec } from '../types';

export const IKernelLauncher = Symbol('IKernelLauncher');
export interface IKernelLauncher {
    launch(interpreterUri: InterpreterUri, kernelName?: string | IJupyterKernelSpec): Promise<IKernelProcess>;
}

export interface IKernelConnection {
    version: number;
    iopub_port: number;
    shell_port: number;
    stdin_port: number;
    control_port: number;
    signature_scheme: 'hmac-sha256';
    hb_port: number;
    ip: string;
    key: string;
    transport: 'tcp' | 'ipc';
}

export interface IKernelProcess extends IAsyncDisposable {
    readonly connection: Readonly<IKernelConnection>;
    ready: Promise<void>;
    readonly kernelSpec: Readonly<IJupyterKernelSpec>;
    exited: Event<number | null>;
    interrupt(): Promise<void>;
    kill(): void;
    launch(interpreter: InterpreterUri, kernelSpec: IJupyterKernelSpec): Promise<void>;
}

export const IKernelFinder = Symbol('IKernelFinder');
export interface IKernelFinder {
    findKernelSpec(interpreterUri: InterpreterUri, kernelName?: string): Promise<IJupyterKernelSpec>;
}
