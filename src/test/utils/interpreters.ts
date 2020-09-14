// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { PythonEnvironment } from '../../client/pythonEnvironments/info';

/**
 * Creates a PythonInterpreter object for testing purposes, with unique name, version and path.
 * If required a custom name, version and the like can be provided.
 *
 * @export
 * @param {Partial<PythonEnvironment>} [info]
 * @returns {PythonEnvironment}
 */
export function createPythonInterpreter(info?: Partial<PythonEnvironment>): PythonEnvironment {
    const rnd = new Date().getTime().toString();
    return {
        displayName: `Something${rnd}`,
        path: `somePath${rnd}`,
        sysPrefix: `someSysPrefix${rnd}`,
        sysVersion: `1.1.1`,
        ...(info || {})
    };
}
