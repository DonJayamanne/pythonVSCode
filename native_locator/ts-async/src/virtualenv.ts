/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Locator, LocatorResult } from './locator';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { PythonEnv } from './utils';

export async function isVirtualenv(env: PythonEnv): Promise<boolean> {
    if (!env.path) {
        return false;
    }

    const file_path = path.dirname(env.executable);
    if (file_path) {
        if (
            (await fs.pathExists(path.join(file_path, 'activate'))) ||
            (await fs.pathExists(path.join(file_path, 'activate.bat')))
        ) {
            return true;
        }

        try {
            const files = await fs.readdir(file_path);
            for (const file of files) {
                if (file.startsWith('activate')) {
                    return true;
                }
            }
        } catch (error) {
            return false;
        }
    }

    return false;
}

export class VirtualEnv {
    async resolve(env: PythonEnv): Promise<PythonEnvironment | undefined> {
        if (await isVirtualenv(env)) {
            return {
                name: env.path && path.dirname(env.path),
                python_executable_path: env.executable?.toString(),
                version: env.version,
                category: PythonEnvironmentCategory.VirtualEnv,
                sys_prefix_path: env.path,
                env_path: env.path,
                env_manager: undefined,
                project_path: undefined,
                python_run_command: [env.executable?.toString()],
            };
        }
        return undefined;
    }
}
