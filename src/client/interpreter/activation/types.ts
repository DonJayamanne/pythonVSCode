// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Resource } from '../../common/types';
import { EnvironmentVariables } from '../../common/variables/types';
import { PythonEnvironment } from '../../pythonEnvironments/info';

export const IEnvironmentActivationService = Symbol('IEnvironmentActivationService');
export interface IEnvironmentActivationService {
    getProcessEnvironmentVariables(resource: Resource, shell?: string): Promise<EnvironmentVariables>;
    getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
        shell?: string,
    ): Promise<NodeJS.ProcessEnv | undefined>;
    getEnvironmentActivationShellCommands(
        resource: Resource,
        interpreter?: PythonEnvironment,
    ): Promise<string[] | undefined>;
}

export const ITerminalEnvVarCollectionService = Symbol('ITerminalEnvVarCollectionService');
export interface ITerminalEnvVarCollectionService {
    /**
     * Returns true if we know with high certainity the terminal prompt is set correctly for a particular resource.
     */
    isTerminalPromptSetCorrectly(resource?: Resource): boolean;
}
