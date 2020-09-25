/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { getInterpreterInfo } from '.';
import { IPythonExtensionChecker } from '../../client/api/types';
import { Resource } from '../../client/common/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

let interpretersCache: Promise<PythonEnvironment[]> | undefined;
@injectable()
export class InterpreterService implements IInterpreterService {
    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreter.event;
    }
    public readonly didChangeInterpreter = new EventEmitter<void>();

    private readonly customInterpretersPerUri = new Map<string, string>();
    constructor(@inject(IPythonExtensionChecker) private readonly extensionChecker: IPythonExtensionChecker) {}

    public async getInterpreters(_resource?: Uri): Promise<PythonEnvironment[]> {
        this.validatePythonExtension();
        if (interpretersCache) {
            return interpretersCache;
        }
        interpretersCache = getAllInterpreters();
        return interpretersCache;
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined> {
        this.validatePythonExtension();
        const pythonPath = this.customInterpretersPerUri.has(resource?.fsPath || '')
            ? this.customInterpretersPerUri.get(resource?.fsPath || '')!
            : process.env.CI_PYTHON_PATH || 'python';
        return getInterpreterInfo(pythonPath);
    }

    public async getInterpreterDetails(pythonPath: string, _resource?: Uri): Promise<undefined | PythonEnvironment> {
        this.validatePythonExtension();
        return getInterpreterInfo(pythonPath);
    }

    public updateInterpreter(resource: Resource, pythonPath: string): void {
        if (pythonPath.trim().length > 0) {
            this.customInterpretersPerUri.set(resource?.fsPath || '', pythonPath);
        }
        this.didChangeInterpreter.fire();
    }

    private validatePythonExtension() {
        if (!this.extensionChecker.isPythonExtensionInstalled) {
            throw new Error('Python extension should be installed when using interpreter service.');
        }
    }
}

async function getAllInterpreters(): Promise<PythonEnvironment[]> {
    const allInterpreters = await Promise.all([
        getInterpreterInfo(process.env.CI_PYTHON_PATH as string),
        getInterpreterInfo(process.env.CI_PYTHON_PATH2 as string),
        getInterpreterInfo('python')
    ]);
    const interpreters: PythonEnvironment[] = [];
    const items = new Set<string>();
    allInterpreters.forEach((item) => {
        if (item && !items.has(item.path)) {
            items.add(item.path);
            interpreters.push(item);
        }
    });
    return interpreters;
}
