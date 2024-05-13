/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
/* eslint-disable no-else-return */
import * as path from 'path';
import * as fs from 'fs-extra';
import { Locator, LocatorResult } from './locator';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { PythonEnv, getVersion } from './utils';

export function get_env_path(python_executable_path: string): string | undefined {
    const parent = path.dirname(python_executable_path);
    if (path.basename(parent) === 'Scripts') {
        return path.dirname(parent);
    } else {
        return parent;
    }
}

export class PythonOnPath  {
    resolve(env: PythonEnv): PythonEnvironment | undefined {
        const bin = process.platform === 'win32' ? 'python.exe' : 'python';
        if (path.basename(env.executable) !== bin) {
            return undefined;
        }
        return {
            name: undefined,
            python_executable_path: env.executable,
            version: env.version,
            category: PythonEnvironmentCategory.System,
            sys_prefix_path: undefined,
            env_path: env.path,
            env_manager: undefined,
            project_path: undefined,
            python_run_command: [env.executable],
        };
    }

    async find(): Promise<LocatorResult | undefined> {
        const env_paths: string = process.env.PATH || '';
        const bin = process.platform === 'win32' ? 'python.exe' : 'python';
        const environments: PythonEnvironment[] = [];
        await Promise.all(env_paths
            .split(path.delimiter)
            .map((p) => path.join(p, bin))
            .map(async (p) => {

                const found = await fs.pathExists(p);
                if (!found) {
                    return;
                }
                const full_path = p;
                const version = await getVersion(full_path);
                const env_path = get_env_path(full_path);
                const env = this.resolve(new PythonEnv(full_path, env_path, version));
                if (env) {
                    environments.push(env);
                }
            }));

        if (environments.length === 0) {
            return undefined;
        } else {
            return { environments };
        }
    }
}
,
