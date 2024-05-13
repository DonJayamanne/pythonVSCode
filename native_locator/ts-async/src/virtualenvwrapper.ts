/* eslint-disable class-methods-use-this */
/* eslint-disable consistent-return */
/* eslint-disable camelcase */
import * as path from 'path';
import * as fs from 'fs-extra';
import { homedir } from 'os';
import { PythonEnvironmentCategory, type PythonEnvironment } from './messaging';
import type { Locator, LocatorResult } from './locator';
import { listPythonEnvironments, type PythonEnv } from './utils';
import { isVirtualenv } from './virtualenv';

async function get_default_virtualenvwrapper_path(): Pormise<string | null> {
    if (process.platform === 'win32') {
        // In Windows, the default path for WORKON_HOME is %USERPROFILE%\Envs.
        // If 'Envs' is not available we should default to '.virtualenvs'. Since that
        // is also valid for windows.
        const home = homedir();
        if (home) {
            let homePath = path.join(home, 'Envs');
            if (await fs.pathExists(homePath)) {
                return homePath;
            }
            homePath = path.join(home, 'virtualenvs');
            if (await fs.pathExists(homePath)) {
                return homePath;
            }
        }
    } else {
        const home = homedir();
        if (home) {
            const homePath = path.join(home, 'virtualenvs');
            if (await fs.pathExists(homePath)) {
                return homePath;
            }
        }
    }
    return null;
}

async function get_work_on_home_path(): Promise<string | null> {
    // The WORKON_HOME variable contains the path to the root directory of all virtualenvwrapper environments.
    // If the interpreter path belongs to one of them then it is a virtualenvwrapper type of environment.
    const work_on_home = process.env.WORKON_HOME;
    if (work_on_home) {
        const workOnHomePath = path.resolve(work_on_home);
        if (await fs.pathExists(workOnHomePath)) {
            return workOnHomePath;
        }
    }
    return get_default_virtualenvwrapper_path();
}

async function is_virtualenvwrapper(env: PythonEnv): Promise< boolean> {
    if (!env.path) {
        return false;
    }
    // For environment to be a virtualenvwrapper based it has to follow these two rules:
    // 1. It should be in a sub-directory under the WORKON_HOME
    // 2. It should be a valid virtualenv environment
    const work_on_home_dir = await get_work_on_home_path();
    if (work_on_home_dir && env.executable.startsWith(work_on_home_dir) && (await isVirtualenv(env))) {
        return true;
    }
    return false;
}

export class VirtualEnvWrapper  {
    async resolve(env: PythonEnv): Promise< PythonEnvironment | undefined> {
        if (await is_virtualenvwrapper(env)) {
            return {
                name: env.path && path.basename(env.path),
                python_executable_path: env.executable,
                version: env.version,
                category: PythonEnvironmentCategory.Venv,
                sys_prefix_path: env.path,
                env_path: env.path,
                python_run_command: [env.executable],
            };
        }
    }

    async find(): Promise< LocatorResult | undefined> {
        const work_on_home = await get_work_on_home_path();
        if (work_on_home) {
            const envs = await listPythonEnvironments(work_on_home) || [];
            const environments: PythonEnvironment[] = [];
            await Promise.all(envs.map(async (env) => {
                const resolvedEnv = await this.resolve(env);
                if (resolvedEnv) {
                    environments.push(resolvedEnv);
                }
            }));

            if (environments.length === 0) {
                return;
            }
            return { environments };
        }
    }
}
