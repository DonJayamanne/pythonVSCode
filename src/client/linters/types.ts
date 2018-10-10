// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { ExecutionInfo, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { LinterTrigger } from '../telemetry/types';

export interface IErrorHandler {
    handleError(error: Error, resource: vscode.Uri, execInfo: ExecutionInfo): Promise<boolean>;
}

export type LinterId = 'flake8' | 'mypy' | 'pep8' | 'prospector' | 'pydocstyle' | 'pylama' | 'pylint' | 'bandit';

export interface ILinterInfo {
    readonly id: LinterId;
    readonly product: Product;
    readonly pathSettingName: string;
    readonly argsSettingName: string;
    readonly enabledSettingName: string;
    readonly configFileNames: string[];
    enableAsync(flag: boolean, resource?: vscode.Uri): Promise<void>;
    isEnabled(resource?: vscode.Uri): boolean;
    pathName(resource?: vscode.Uri): string;
    linterArgs(resource?: vscode.Uri): string[];
    getExecutionInfo(customArgs: string[], resource?: vscode.Uri): ExecutionInfo;
}

export interface ILinter {
    readonly info: ILinterInfo;
    lint(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]>;
}

export const ILinterManager = Symbol('ILinterManager');
export interface ILinterManager {
    getAllLinterInfos(): ILinterInfo[];
    getLinterInfo(product: Product): ILinterInfo;
    getActiveLinters(resource?: vscode.Uri): ILinterInfo[];
    isLintingEnabled(resource?: vscode.Uri): boolean;
    enableLintingAsync(enable: boolean, resource?: vscode.Uri): Promise<void>;
    setActiveLintersAsync(products: Product[], resource?: vscode.Uri): Promise<void>;
    createLinter(product: Product, outputChannel: vscode.OutputChannel, serviceContainer: IServiceContainer, resource?: vscode.Uri): ILinter;
}

export interface ILintMessage {
    line: number;
    column: number;
    code: string | undefined;
    message: string;
    type: string;
    severity?: LintMessageSeverity;
    provider: string;
}
export enum LintMessageSeverity {
    Hint,
    Error,
    Warning,
    Information
}

export const ILintingEngine = Symbol('ILintingEngine');
export interface ILintingEngine {
    readonly diagnostics: vscode.DiagnosticCollection;
    lintOpenPythonFiles(): Promise<vscode.DiagnosticCollection>;
    lintDocument(document: vscode.TextDocument, trigger: LinterTrigger): Promise<void>;
    // tslint:disable-next-line:no-any
    linkJupiterExtension(jupiter: vscode.Extension<any> | undefined): Promise<void>;
    clearDiagnostics(document: vscode.TextDocument): void;
}
