import { injectable } from 'inversify';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { EventEmitter, Uri } from 'vscode';
import { getInterpreterInfo } from '.';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

@injectable()
export class InterpreterService implements IInterpreterService {
    public readonly onDidChangeInterpreter = new EventEmitter<void>().event;

    public async getInterpreters(_resource?: Uri): Promise<PythonEnvironment[]> {
        const [active, globalInterpreter] = await Promise.all([
            getInterpreterInfo(process.env.CI_PYTHON_PATH as string),
            getInterpreterInfo('python')
        ]);
        const interpreters: PythonEnvironment[] = [];
        if (active) {
            interpreters.push(active);
        }
        if (globalInterpreter) {
            interpreters.push(globalInterpreter);
        }
        return interpreters;
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
