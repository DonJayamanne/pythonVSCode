/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Locator, LocatorResult } from './locator';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { PythonEnv } from './utils';

export function isVirtualenv(env: PythonEnv): boolean {
    if (!env.path) {
        return false;
    }

    const file_path = path.dirname(env.executable);
    if (file_path) {
        if (
            fs.pathExistsSync(path.join(file_path, 'activate')) ||
            fs.pathExistsSync(path.join(file_path, 'activate.bat'))
        ) {
            return true;
        }

        try {
            const files = fs.readdirSync(file_path);
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

export class VirtualEnv implements Locator {
    resolve(env: PythonEnv): PythonEnvironment | undefined {
        if (isVirtualenv(env)) {
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

    find(): LocatorResult | undefined {
        return undefined;
    }
}
