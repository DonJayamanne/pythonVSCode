// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const IWindowsStoreInterpreter = Symbol('IWindowsStoreInterpreter');
export interface IWindowsStoreInterpreter {
    /**
     * Whether this is a Windows Store/App Interpreter.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof WindowsStoreInterpreter
     */
    isWindowsStoreInterpreter(pythonPath: string): Promise<boolean>;
}
