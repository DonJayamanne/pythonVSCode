/* eslint-disable class-methods-use-this */
import * as path from 'path';
import { Locator, LocatorResult } from './locator';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { findPyvenvConfigPath, type PythonEnv } from './utils';

export function isVenv(env: PythonEnv): boolean {
    // env path cannot be empty.
    if (!env.path) {
        return false;
    }
    return findPyvenvConfigPath(env.executable) !== undefined;
}

export class Venv implements Locator {
    resolve(env: PythonEnv): PythonEnvironment | undefined {
        if (isVenv(env)) {
            return {
                name: env.path && path.basename(env.path),
                python_executable_path: env.executable,
                version: env.version,
                category: PythonEnvironmentCategory.Venv,
                sys_prefix_path: env.path,
                env_path: env.path,
                env_manager: undefined,
                project_path: undefined,
                python_run_command: [env.executable],
            };
        }
        return undefined;
    }

    find(): LocatorResult | undefined {
        // There are no common global locations for virtual environments.
        // We expect the user of this class to call `isCompatible`
        return undefined;
    }
}
