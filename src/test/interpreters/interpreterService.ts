/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { getInterpreterInfo } from '.';
import { Resource } from '../../client/common/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

let interpretersCache: Promise<PythonEnvironment[]> | undefined;
@injectable()
export class InterpreterService implements IInterpreterService {
    public readonly didChangeInterpreter = new EventEmitter<void>();

    public get onDidChangeInterpreter(): Event<void> {
        return this.didChangeInterpreter.event;
    }

    private readonly customInterpretersPerUri = new Map<string, string>();

    public async getInterpreters(_resource?: Uri): Promise<PythonEnvironment[]> {
        if (interpretersCache) {
            return interpretersCache;
        }
        interpretersCache = getAllInterpreters();
        return interpretersCache;
    }

    public async getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined> {
        const pythonPath = this.customInterpretersPerUri.has(resource?.fsPath || '')
            ? this.customInterpretersPerUri.get(resource?.fsPath || '')!
            : process.env.CI_PYTHON_PATH || 'python';
        return getInterpreterInfo(pythonPath);
    }

    public async getInterpreterDetails(pythonPath: string, _resource?: Uri): Promise<undefined | PythonEnvironment> {
        return getInterpreterInfo(pythonPath);
    }

    public updateInterpreter(resource: Resource, pythonPath: string): void {
        if (pythonPath.trim().length > 0) {
            this.customInterpretersPerUri.set(resource?.fsPath || '', pythonPath);
        }
        this.didChangeInterpreter.fire();
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
