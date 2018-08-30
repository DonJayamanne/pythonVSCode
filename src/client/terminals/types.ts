// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TextEditor, Uri } from 'vscode';

export const ICodeExecutionService = Symbol('ICodeExecutionService');

export interface ICodeExecutionService {
    execute(code: string, resource?: Uri): Promise<void>;
    executeFile(file: Uri): Promise<void>;
    initializeRepl(resource?: Uri): Promise<void>;
}

export const ICodeExecutionHelper = Symbol('ICodeExecutionHelper');

export interface ICodeExecutionHelper {
    normalizeLines(code: string): Promise<string>;
    getFileToExecute(): Promise<Uri | undefined>;
    saveFileIfDirty(file: Uri): Promise<void>;
    getSelectedTextToExecute(textEditor: TextEditor): Promise<string | undefined>;
}

export const ICodeExecutionManager = Symbol('ICodeExecutionManager');

export interface ICodeExecutionManager {
    registerCommands(): void;
}
