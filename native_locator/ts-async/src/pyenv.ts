/* eslint-disable class-methods-use-this */
/* eslint-disable consistent-return */
import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir } from 'os';
import { Locator, LocatorResult } from './locator';
import { EnvManager, EnvManagerType, PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { findAndParsePyvenvCfg, findPythonBinaryPath, PythonEnv } from './utils';
import { getKnowGlobalSearchLocations } from './known';

export function getHomePyenvDir(): string | undefined {
    const home = homedir();
    if (home) {
        return path.join(home, '.pyenv');
    }
}

export async function getBinaryFromKnownPaths(): Promise<string | undefined> {
    const knownPaths = getKnowGlobalSearchLocations();
    for (const knownPath of knownPaths) {
        const bin = path.join(knownPath, 'pyenv');
        if (await fs.pathExists(bin)) {
            return bin;
        }
    }
}

function getPyenvDir(): string | undefined {
    const pyenvRoot = process.env.PYENV_ROOT;
    if (pyenvRoot) {
        return pyenvRoot;
    }

    const pyenv = process.env.PYENV;
    if (pyenv) {
        return pyenv;
    }

    return getHomePyenvDir();
}

async function getPyenvBinary(): Promise<string | undefined> {
    const dir = getPyenvDir();
    if (dir) {
        const exe = path.join(dir, 'bin', 'pyenv');
        if (fs.existsSync(exe)) {
            return exe;
        }
    }
    return getBinaryFromKnownPaths();
}

function getPyenvVersion(folderName: string): string | undefined {
    const pythonRegex = /^(\d+\.\d+\.\d+)$/;
    const match = pythonRegex.exec(folderName);
    if (match) {
        return match[1];
    }

    const devRegex = /^(\d+\.\d+-dev)$/;
    const devMatch = devRegex.exec(folderName);
    if (devMatch) {
        return devMatch[1];
    }

    const alphaRegex = /^(\d+\.\d+.\d+\w\d+)/;
    const alphaMatch = alphaRegex.exec(folderName);
    if (alphaMatch) {
        return alphaMatch[1];
    }
}

function getPurePythonEnvironment(
    executable: string,
    folderPath: string,
    manager: EnvManager | undefined,
): PythonEnvironment | undefined {
    const version = getPyenvVersion(path.basename(folderPath));
    if (version) {
        return {
            python_executable_path: executable,
            category: PythonEnvironmentCategory.Pyenv,
            version,
            env_path: folderPath,
            sys_prefix_path: folderPath,
            env_manager: manager,
            python_run_command: [executable],
        };
    }
}

async function getVirtualEnvEnvironment(
    executable: string,
    folderPath: string,
    manager: EnvManager | undefined,
): Promise<PythonEnvironment | undefined> {
    const pyenvCfg = await findAndParsePyvenvCfg(executable);
    if (pyenvCfg) {
        const folderName = path.basename(folderPath);
        return {
            name: folderName,
            python_executable_path: executable,
            category: PythonEnvironmentCategory.PyenvVirtualEnv,
            version: pyenvCfg.version,
            env_path: folderPath,
            sys_prefix_path: folderPath,
            env_manager: manager,
            python_run_command: [executable],
        };
    }
}

export async function listPyenvEnvironments(manager: EnvManager | undefined): Promise<PythonEnvironment[] | undefined> {
    const pyenvDir = getPyenvDir();
    if (!pyenvDir) {
        return;
    }

    const envs: PythonEnvironment[] = [];
    const versionsDir = path.join(pyenvDir, 'versions');

    try {
        const entries = await fs.readdir(versionsDir);
        await Promise.all(
            entries.map(async (entry) => {
                const folderPath = path.join(versionsDir, entry);
                const stats = await fs.stat(folderPath);
                if (stats.isDirectory()) {
                    const executable = await findPythonBinaryPath(folderPath);
                    if (executable) {
                        const purePythonEnv = getPurePythonEnvironment(executable, folderPath, manager);
                        if (purePythonEnv) {
                            envs.push(purePythonEnv);
                        } else {
                            const virtualEnv = await getVirtualEnvEnvironment(executable, folderPath, manager);
                            if (virtualEnv) {
                                envs.push(virtualEnv);
                            }
                        }
                    }
                }
            }),
        );
    } catch (error) {
        console.error(`Failed to read directory: ${versionsDir}`);
    }

    return envs;
}

export async function find(): Promise<LocatorResult | undefined> {
    const pyenvBinary = await getPyenvBinary();
    if (!pyenvBinary) {
        return undefined;
    }

    const manager: EnvManager = { executable_path: pyenvBinary, tool: EnvManagerType.Pyenv };
    const environments: PythonEnvironment[] = [];
    const envs = await listPyenvEnvironments(manager);
    if (envs) {
        environments.push(...envs);
    }

    if (environments.length === 0) {
        return { managers: [manager] };
    }
    return { environments };
}
