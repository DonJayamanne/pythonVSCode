/* eslint-disable no-useless-return */
/* eslint-disable no-continue */
/* eslint-disable camelcase */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import type { PythonEnvironment } from './messaging';
import { find as findPyenv } from './pyenv';
import { find as findHomebrew } from './homebrew';
import { find as findConda } from './conda';
import { listGlobalVirtualEnvs } from './global_virtualenvs';
import { PipEnv } from './pipenv';
import { VirtualEnvWrapper } from './virtualenvwrapper';
import { VirtualEnv } from './virtualenv';
import { Venv } from './venv';

async function main() {
    const started = Date.now();
    console.log('Starting async function');
    const environments: PythonEnvironment[] = [];

    const [pyenvs, homebrews, condas] = await Promise.all([findPyenv(), findHomebrew(), findConda()]);
    if (pyenvs?.environments) {
        environments.push(...pyenvs.environments);
    }
    if (homebrews?.environments) {
        environments.push(...homebrews.environments);
    }
    if (condas?.environments) {
        environments.push(...condas.environments);
    }
    const found = new Set<string>();
    environments.forEach((e) => {
        found.add(e.python_executable_path || e.env_path || '');
    });

    const pipEnv = new PipEnv();
    const virtualEnvWrapper = new VirtualEnvWrapper();
    const virtualEnv = new VirtualEnv();
    const venv = new Venv();
    const globalVenvs = await listGlobalVirtualEnvs();
    await Promise.all(
        globalVenvs.map(async (env) => {
            if (found.has(env.executable || env.path || '')) {
                return;
            }
            let resolved = await pipEnv.resolve(env);
            if (resolved) {
                found.add(resolved.python_executable_path || resolved.env_path || '');
                environments.push(resolved);
                return;
            }

            resolved = await virtualEnvWrapper.resolve(env);
            if (resolved) {
                found.add(resolved.python_executable_path || resolved.env_path || '');
                environments.push(resolved);
                return;
            }

            resolved = await venv.resolve(env);
            if (resolved) {
                found.add(resolved.python_executable_path || resolved.env_path || '');
                environments.push(resolved);
                return;
            }

            resolved = await virtualEnv.resolve(env);
            if (resolved) {
                found.add(resolved.python_executable_path || resolved.env_path || '');
                environments.push(resolved);
                return;
            }
        }),
    );
    const completion_time = Date.now() - started;
    console.log(`Async function completed in ${completion_time}ms`);
    console.log(JSON.stringify(environments, undefined, 4));
    console.log(`Async function completed in ${completion_time}ms`);
}

main();
