// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Architecture } from '../../common/utils/platform';
import { PythonVersion } from './pythonVersion';

/**
 * The supported Python environment types.
 */
export enum EnvironmentType {
    Unknown = 'Unknown',
    Conda = 'Conda',
    VirtualEnv = 'VirtualEnv',
    Pipenv = 'PipEnv',
    Pyenv = 'Pyenv',
    Venv = 'Venv',
    WindowsStore = 'WindowsStore',
    Poetry = 'Poetry',
    VirtualEnvWrapper = 'VirtualEnvWrapper',
    Global = 'Global',
    System = 'System'
}

type ReleaseLevel = 'alpha' | 'beta' | 'candidate' | 'final' | 'unknown';

/**
 * The components of a Python version.
 *
 * These match the elements of `sys.version_info`.
 */
export type PythonVersionInfo = [number, number, number, ReleaseLevel];

/**
 * Details about a Python runtime.
 *
 * @prop path - the location of the executable file
 * @prop version - the runtime version
 * @prop sysVersion - the raw value of `sys.version`
 * @prop architecture - of the host CPU (e.g. `x86`)
 * @prop sysPrefix - the environment's install root (`sys.prefix`)
 * @prop pipEnvWorkspaceFolder - the pipenv root, if applicable
 */
export type InterpreterInformation = {
    path: string;
    version?: PythonVersion;
    sysVersion?: string;
    architecture: Architecture;
    sysPrefix: string;
};

/**
 * Details about a Python environment.
 *
 * @prop companyDisplayName - the user-facing name of the distro publisher
 * @prop displayName - the user-facing name for the environment
 * @prop type - the kind of Python environment
 * @prop envName - the environment's name, if applicable (else `envPath` is set)
 * @prop envPath - the environment's root dir, if applicable (else `envName`)
 * @prop cachedEntry - whether or not the info came from a cache
 */
// Note that "cachedEntry" is specific to the caching machinery
// and doesn't really belong here.
export type PythonEnvironment = InterpreterInformation & {
    displayName?: string;
    envType: EnvironmentType;
    envName?: string;
    envPath?: string;
};
