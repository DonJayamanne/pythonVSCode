
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { InterpreterType } from '../contracts';
export const IVirtualEnvironmentManager = Symbol('VirtualEnvironmentManager');
export interface IVirtualEnvironmentManager {
    getEnvironmentName(pythonPath: string): Promise<string>;
    getEnvironmentType(pythonPath: string, resource?: Uri): Promise<InterpreterType>;
}
