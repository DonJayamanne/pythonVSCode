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

function main() {
    const started = Date.now();
    console.log('Starting async function');
    const environments: PythonEnvironment[] = [];

    let result = findPyenv();
    if (result?.environments) {
        environments.push(...result.environments);
    }

    result = findHomebrew();
    if (result?.environments) {
        environments.push(...result.environments);
    }

    result = findConda();
    if (result?.environments) {
        environments.push(...result.environments);
    }

    const found = new Set<string>();
    environments.forEach((e) => {
        found.add(e.python_executable_path || e.env_path || '');
    });

    const pipEnv = new PipEnv();
    const virtualEnvWrapper = new VirtualEnvWrapper();
    const virtualEnv = new VirtualEnv();
    const venv = new Venv();
    for (const env of listGlobalVirtualEnvs()) {
        if (found.has(env.executable || env.path || '')) {
            continue;
        }
        let resolved = pipEnv.resolve(env);
        if (resolved) {
            found.add(resolved.python_executable_path || resolved.env_path || '');
            environments.push(resolved);
            continue;
        }

        resolved = virtualEnvWrapper.resolve(env);
        if (resolved) {
            found.add(resolved.python_executable_path || resolved.env_path || '');
            environments.push(resolved);
            continue;
        }

        resolved = venv.resolve(env);
        if (resolved) {
            found.add(resolved.python_executable_path || resolved.env_path || '');
            environments.push(resolved);
            continue;
        }

        resolved = virtualEnv.resolve(env);
        if (resolved) {
            found.add(resolved.python_executable_path || resolved.env_path || '');
            environments.push(resolved);
            continue;
        }
    }
    const completion_time = Date.now() - started;
    console.log(`Async function completed in ${completion_time}ms`);
    console.log(JSON.stringify(environments, undefined, 4));
    console.log(`Async function completed in ${completion_time}ms`);
}

main();
