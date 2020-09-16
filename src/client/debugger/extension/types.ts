// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Readable } from 'stream';
import { DebugAdapterDescriptorFactory, DebugAdapterTrackerFactory, Disposable } from 'vscode';

export enum PythonPathSource {
    launchJson = 'launch.json',
    settingsJson = 'settings.json'
}

export const IDebugAdapterDescriptorFactory = Symbol('IDebugAdapterDescriptorFactory');
export interface IDebugAdapterDescriptorFactory extends DebugAdapterDescriptorFactory {}

export const IDebugSessionLoggingFactory = Symbol('IDebugSessionLoggingFactory');

export interface IDebugSessionLoggingFactory extends DebugAdapterTrackerFactory {}

export const IOutdatedDebuggerPromptFactory = Symbol('IOutdatedDebuggerPromptFactory');

export interface IOutdatedDebuggerPromptFactory extends DebugAdapterTrackerFactory {}

export const IProtocolParser = Symbol('IProtocolParser');
export interface IProtocolParser extends Disposable {
    connect(stream: Readable): void;
    once(event: string | symbol, listener: Function): this;
    on(event: string | symbol, listener: Function): this;
}
