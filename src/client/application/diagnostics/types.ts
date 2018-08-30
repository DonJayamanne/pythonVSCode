// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { DiagnosticSeverity } from 'vscode';

export enum DiagnosticScope {
    Global = 'Global',
    WorkspaceFolder = 'WorkspaceFolder'
}

export interface IDiagnostic {
    readonly code: string;
    readonly message: string;
    readonly severity: DiagnosticSeverity;
    readonly scope: DiagnosticScope;
}

export const IDiagnosticsService = Symbol('IDiagnosticsService');

export interface IDiagnosticsService {
    diagnose(): Promise<IDiagnostic[]>;
    canHandle(diagnostic: IDiagnostic): Promise<boolean>;
    handle(diagnostics: IDiagnostic[]): Promise<void>;
}

export const IDiagnosticFilterService = Symbol('IDiagnosticFilterService');

export interface IDiagnosticFilterService {
    shouldIgnoreDiagnostic(code: string): Promise<boolean>;
    ignoreDiagnostic(code: string, scope: DiagnosticScope): Promise<void>;
}

export const IDiagnosticHandlerService = Symbol('IDiagnosticHandlerService');

export interface IDiagnosticHandlerService<T> {
    handle(diagnostic: IDiagnostic, options?: T): Promise<void>;
}

export interface IDiagnosticCommand {
    readonly diagnostic: IDiagnostic;
    invoke(): Promise<void>;
}
