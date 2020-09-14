import { injectable } from 'inversify';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IWindowsStoreInterpreter } from '../../client/interpreter/locators/types';

@injectable()
export class WindowsStoreInterpreter implements IWindowsStoreInterpreter {
    /**
     * Whether this is a Windows Store/App Interpreter.
     *
     * @param {string} pythonPath
     * @returns {boolean}
     * @memberof WindowsStoreInterpreter
     */
    public async isWindowsStoreInterpreter(pythonPath: string): Promise<boolean> {
        const pythonPathToCompare = pythonPath.toUpperCase().replace(/\//g, '\\');
        return (
            pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\'.toUpperCase()) ||
            pythonPathToCompare.includes('\\Program Files\\WindowsApps\\'.toUpperCase()) ||
            pythonPathToCompare.includes('\\Microsoft\\WindowsApps\\PythonSoftwareFoundation'.toUpperCase())
        );
    }
}
