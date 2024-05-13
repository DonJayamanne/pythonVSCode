/* eslint-disable no-continue */
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { findPythonBinaryPath, getVersion, type PythonEnv } from './utils';

export function getGlobalVirtualenvDirs(): string[] {
    const venvDirs: string[] = [];

    const workOnHome = process.env.WORKON_HOME;
    if (workOnHome) {
        const canonicalizedPath = fs.realpathSync(workOnHome);
        if (fs.existsSync(canonicalizedPath)) {
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
        for (const dir of dirs) {
            if (fs.existsSync(dir)) {
                venvDirs.push(dir);
            }
        }
        if (process.platform === 'linux') {
            const envs = path.resolve(homePath, 'Envs');
            if (fs.existsSync(envs)) {
                venvDirs.push(envs);
            }
        }
    }

    return venvDirs;
}

export function listGlobalVirtualEnvs(): PythonEnv[] {
    const pythonEnvs: PythonEnv[] = [];
    const venvDirs = getGlobalVirtualenvDirs();

    for (const rootDir of venvDirs) {
        const dirs = fs.readdirSync(rootDir);
        for (const venvDir of dirs) {
            const venvPath = path.resolve(rootDir, venvDir);
            if (!fs.statSync(venvPath).isDirectory()) {
                continue;
            }
            const executable = findPythonBinaryPath(venvPath);
            if (executable) {
                pythonEnvs.push({
                    executable,
                    path: venvPath,
                    version: getVersion(executable),
                });
            }
        }
    }

    return pythonEnvs;
}
