/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable max-classes-per-file */
import * as fs from 'fs';
import * as path from 'path';
import type { Locator, LocatorResult } from './locator';
import type { PythonEnv } from './utils';
import { PythonEnvironmentCategory, type PythonEnvironment } from './messaging';

function get_pipenv_project(env: PythonEnv): string | undefined {
    if (!env.path) {
        return;
    }
    const projectFile = path.join(env.path, '.project');
    if (fs.existsSync(projectFile)) {
        const contents = fs.readFileSync(projectFile, 'utf8');
        const projectFolder = contents.trim();
        if (fs.existsSync(projectFolder)) {
            return projectFolder;
        }
    }
    return undefined;
}

export class PipEnv implements Locator {
    resolve(env: PythonEnv): PythonEnvironment | undefined {
        const projectPath = get_pipenv_project(env);
        if (projectPath) {
            return {
                python_executable_path: env.executable,
                version: env.version,
                category: PythonEnvironmentCategory.Pipenv,
                env_path: env.path,
                project_path: projectPath,
            };
        }
        return undefined;
    }

    find(): LocatorResult | undefined {
        return undefined;
    }
}
