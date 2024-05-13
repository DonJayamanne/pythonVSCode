import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir } from 'os';
import { findPythonBinaryPath, getVersion, type PythonEnv } from './utils';

/* eslint-disable no-continue */

export async function getGlobalVirtualenvDirs(): Promise<string[]> {
    const venvDirs: string[] = [];

    const workOnHome = process.env.WORKON_HOME;
    if (workOnHome) {
        const canonicalizedPath = fs.realpathSync(workOnHome);
        if (await fs.pathExists(canonicalizedPath)) {
            venvDirs.push(canonicalizedPath);
        }
    }

    const home = homedir();
    if (home) {
        const homePath = path.resolve(home);
        const dirs = [
            path.resolve(homePath, 'envs'),
            path.resolve(homePath, '.direnv'),
            path.resolve(homePath, '.venvs'),
            path.resolve(homePath, '.virtualenvs'),
            path.resolve(homePath, '.local', 'share', 'virtualenvs'),
        ];
        await Promise.all(dirs.map(async (dir) => {
            if (await fs.pathExists(dir)) {
                venvDirs.push(dir);
            }
        }));
        if (process.platform === 'linux') {
            const envs = path.resolve(homePath, 'Envs');
            if (await fs.pathExists(envs)) {
                venvDirs.push(envs);
            }
        }
    }

    return venvDirs;
}

export async function listGlobalVirtualEnvs(): Promise<PythonEnv[]> {
    const pythonEnvs: PythonEnv[] = [];
    const venvDirs = await getGlobalVirtualenvDirs();

    await Promise.all(venvDirs.map(async (rootDir) => {
        const dirs = await fs.readdir(rootDir);
        await Promise.all(dirs.map(async (venvDir) => {
            const venvPath = path.resolve(rootDir, venvDir);
            if (!(await fs.stat(venvPath)).isDirectory()) {
                return;;
            }
            const executable = await findPythonBinaryPath(venvPath);
            if (executable) {
                pythonEnvs.push({
                    executable,
                    path: venvPath,
                    version: await getVersion(executable),
                });
            }
        }));
    }));

    return pythonEnvs;
}
