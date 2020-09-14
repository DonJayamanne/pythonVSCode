// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter, Uri } from 'vscode';
import { getInterpreterInfo } from '.';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

export class InterpreterService implements IInterpreterService {
    public readonly onDidChangeInterpreter = new EventEmitter<void>().event;

    public async getInterpreters(resource?: Uri): Promise<PythonEnvironment[]> {
        const active = await this.getActiveInterpreter(resource);
        return active ? [active] : [];
    }

    public async getActiveInterpreter(_resource?: Uri): Promise<PythonEnvironment | undefined> {
        return getInterpreterInfo(process.env.CI_PYTHON_PATH || 'python');
    }

    public async getInterpreterDetails(pythonPath: string, _resource?: Uri): Promise<undefined | PythonEnvironment> {
        return getInterpreterInfo(pythonPath);
    }

    public initialize(): void {
        // Noop.
    }
}
