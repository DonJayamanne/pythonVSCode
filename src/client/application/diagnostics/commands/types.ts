// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DiagnosticScope, IDiagnostic, IDiagnosticCommand } from '../types';

export type CommandOption<Type, Option> = { type: Type; options: Option };
export type LaunchBrowserOption = CommandOption<'launch', string>;
export type IgnoreDiagnostOption = CommandOption<'ignore', DiagnosticScope>;
export type CommandOptions = LaunchBrowserOption | IgnoreDiagnostOption;

export const IDiagnosticsCommandFactory = Symbol('IDiagnosticsCommandFactory');

export interface IDiagnosticsCommandFactory {
    createCommand<T>(diagnostic: IDiagnostic, options: CommandOptions): IDiagnosticCommand;
}
