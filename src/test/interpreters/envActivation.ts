import { injectable } from 'inversify';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getActivatedEnvVariables } from '.';
import { Resource } from '../../client/common/types';
import { IEnvironmentActivationService } from '../../client/interpreter/activation/types';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService {
    public getActivatedEnvironmentVariables(
        _resource: Resource,
        interpreter?: PythonEnvironment,
        _allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined> {
        return getActivatedEnvVariables(interpreter?.path || process.env.CI_PYTHON_PATH || 'python');
    }
}
