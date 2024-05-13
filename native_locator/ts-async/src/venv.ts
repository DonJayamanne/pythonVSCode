/* eslint-disable class-methods-use-this */
import * as path from 'path';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { findPyvenvConfigPath, type PythonEnv } from './utils';

export async function isVenv(env: PythonEnv): Promise<boolean> {
    // env path cannot be empty.
    if (!env.path) {
        return false;
    }
    return (await findPyvenvConfigPath(env.executable)) !== undefined;
}

export class Venv {
    async resolve(env: PythonEnv): Promise< PythonEnvironment | undefined> {
        if (await isVenv(env)) {
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


}
