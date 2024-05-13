/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
/* eslint-disable consistent-return */
/* eslint-disable max-classes-per-file */
import * as fs from 'fs-extra';
import * as path from 'path';
import type { PythonEnv } from './utils';
import { PythonEnvironmentCategory, type PythonEnvironment } from './messaging';

async function get_pipenv_project(env: PythonEnv): Promise<string | undefined> {
    if (!env.path) {
        return;
    }
    const projectFile = path.join(env.path, '.project');
    if (await fs.pathExists(projectFile)) {
        const contents = await fs.readFile(projectFile, 'utf8');
        const projectFolder = contents.trim();
        if (await fs.pathExists(projectFolder)) {
            return projectFolder;
        }
    }
    return undefined;
}

export class PipEnv {
    async resolve(env: PythonEnv): Promise<PythonEnvironment | undefined> {
        const projectPath = await get_pipenv_project(env);
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


}
