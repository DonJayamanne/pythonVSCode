/* eslint-disable camelcase */
/* eslint-disable no-else-return */
import * as path from 'path';
import * as fs from 'fs';
import { homedir } from 'os';
import { getKnowGlobalSearchLocations } from './known';
import { EnvManagerType, PythonEnvironmentCategory, type EnvManager, type PythonEnvironment } from './messaging';
import type { LocatorResult } from './locator';
import { findPythonBinaryPath } from './utils';

interface CondaEnv {
    named: boolean;
    name: string;
    path: string;
}

function getCondaMetaPath(anyPath: string): string {
    if (anyPath.endsWith('bin/python')) {
        const parent = path.dirname(anyPath);
        const grandParent = path.dirname(parent);
        return path.join(grandParent, 'conda-meta');
    } else if (anyPath.endsWith('bin')) {
        const parent = path.dirname(anyPath);
        return path.join(parent, 'conda-meta');
    } else {
        return path.join(anyPath, 'conda-meta');
    }
}

function isCondaEnvironment(anyPath: string): boolean {
    const condaMetaPath = getCondaMetaPath(anyPath);
    return condaMetaPath !== undefined && fs.existsSync(condaMetaPath);
}

function getVersionFromMetaJson(jsonFile: string): string | undefined {
    const fileName = path.basename(jsonFile);
    const regex = /([\d\w\-]*)-([\d\.]*)-.*\.json/;
    const match = fileName.match(regex);
    return match ? match[2] : undefined;
}

function getCondaPackageJsonPath(anyPath: string, packageName: string): string | undefined {
    const packagePrefix = `${packageName}-`;
    const condaMetaPath = getCondaMetaPath(anyPath);
    const entries = fs.readdirSync(condaMetaPath);
    for (const entry of entries) {
        const filePath = path.join(condaMetaPath, entry);
        const fileName = path.basename(filePath);
        if (fileName.startsWith(packagePrefix) && fileName.endsWith('.json')) {
            return filePath;
        }
    }
    return undefined;
}

export function isPythonCondaEnv(anyPath: string): boolean {
    const condaPythonJsonPath = getCondaPackageJsonPath(anyPath, 'python');
    return condaPythonJsonPath !== undefined && fs.existsSync(condaPythonJsonPath);
}

function getCondaPythonVersion(anyPath: string): string | undefined {
    const condaPythonJsonPath = getCondaPackageJsonPath(anyPath, 'python');
    return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : undefined;
}

function getCondaBinNames(): string[] {
    return process.platform === 'win32' ? ['conda.exe', 'conda.bat'] : ['conda'];
}

function findCondaBinaryOnPath(): string | undefined {
    const paths = process.env.PATH?.split(path.delimiter) || [];
    const condaBinNames = getCondaBinNames();
    for (const pathEntry of paths) {
        for (const binName of condaBinNames) {
            const condaPath = path.join(pathEntry, binName);
            try {
                const stats = fs.statSync(condaPath);
                if (stats.isFile() || stats.isSymbolicLink()) {
                    return condaPath;
                }
            } catch (error) {
                //
            }
        }
    }
    return undefined;
}

// function getKnownCondaLocations(): string[] {
//     const userHome = process.env.USERPROFILE;
//     const programData = process.env.PROGRAMDATA;
//     const allUsersProfile = process.env.ALLUSERSPROFILE;
//     const homeDrive = process.env.HOMEDRIVE;
//     const knownPaths = [
//         path.join(userHome, 'Anaconda3', 'Scripts'),
//         path.join(programData, 'Anaconda3', 'Scripts'),
//         path.join(allUsersProfile, 'Anaconda3', 'Scripts'),
//         path.join(homeDrive, 'Anaconda3', 'Scripts'),
//         path.join(userHome, 'Miniconda3', 'Scripts'),
//         path.join(programData, 'Miniconda3', 'Scripts'),
//         path.join(allUsersProfile, 'Miniconda3', 'Scripts'),
//         path.join(homeDrive, 'Miniconda3', 'Scripts'),
//     ];
//     return knownPaths.concat(getKnowGlobalSearchLocations());
// }
function getKnownCondaLocations(): string[] {
    const knownPaths: string[] = [
        '/opt/anaconda3/bin',
        '/opt/miniconda3/bin',
        '/usr/local/anaconda3/bin',
        '/usr/local/miniconda3/bin',
        '/usr/anaconda3/bin',
        '/usr/miniconda3/bin',
        '/home/anaconda3/bin',
        '/home/miniconda3/bin',
        '/anaconda3/bin',
        '/miniconda3/bin',
    ];
    const home = homedir();
    if (home) {
        knownPaths.push(path.join(home, 'anaconda3/bin'));
        knownPaths.push(path.join(home, 'miniconda3/bin'));
    }
    knownPaths.push(...getKnowGlobalSearchLocations());
    return knownPaths;
}

function findCondaBinaryInKnownLocations(): string | undefined {
    const condaBinNames = getCondaBinNames();
    const knownLocations = getKnownCondaLocations();
    for (const location of knownLocations) {
        for (const binName of condaBinNames) {
            const condaPath = path.join(location, binName);
            try {
                const stats = fs.statSync(condaPath);
                if (stats.isFile() || stats.isSymbolicLink()) {
                    return condaPath;
                }
            } catch (error) {
                //
            }
        }
    }
    return undefined;
}

function findCondaBinary(): string | undefined {
    const condaBinaryOnPath = findCondaBinaryOnPath();
    return condaBinaryOnPath || findCondaBinaryInKnownLocations();
}

function getCondaVersion(condaBinary: string): string | undefined {
    let parent = path.dirname(condaBinary);
    if (parent.endsWith('bin')) {
        parent = path.dirname(parent);
    }
    if (parent.endsWith('Library')) {
        parent = path.dirname(parent);
    }
    const condaPythonJsonPath =
        getCondaPackageJsonPath(parent, 'conda') || getCondaPackageJsonPath(path.dirname(parent), 'conda');
    return condaPythonJsonPath ? getVersionFromMetaJson(condaPythonJsonPath) : undefined;
}

function getCondaEnvsFromEnvironmentTxt(): string[] {
    const envs: string[] = [];
    const home = process.env.USERPROFILE;
    if (home) {
        const environmentTxt = path.join(home, '.conda', 'environments.txt');
        try {
            const content = fs.readFileSync(environmentTxt, 'utf-8');
            envs.push(...content.split('\n'));
        } catch (error) {
            //
        }
    }
    return envs;
}

function getKnownEnvLocations(condaBin: string): string[] {
    const paths: string[] = [];
    const home = process.env.USERPROFILE;
    if (home) {
        const condaEnvs = path.join(home, '.conda', 'envs');
        paths.push(condaEnvs);
    }
    const parent = path.dirname(condaBin);
    if (parent) {
        paths.push(parent);
        const condaEnvs = path.join(parent, 'envs');
        paths.push(condaEnvs);
        const grandParent = path.dirname(parent);
        if (grandParent) {
            paths.push(grandParent);
            paths.push(path.join(grandParent, 'envs'));
        }
    }
    return paths;
}

function getCondaEnvsFromKnownEnvLocations(condaBin: string): string[] {
    const envs: string[] = [];
    const locations = getKnownEnvLocations(condaBin);
    for (const location of locations) {
        if (isCondaEnvironment(location)) {
            envs.push(location);
        }
        try {
            const entries = fs.readdirSync(location);
            for (const entry of entries) {
                const entryPath = path.join(location, entry);
                const stats = fs.statSync(entryPath);
                if (stats.isDirectory() && isCondaEnvironment(entryPath)) {
                    envs.push(entryPath);
                }
            }
        } catch (error) {
            //
        }
    }
    return envs;
}

function getDistinctCondaEnvs(condaBin: string): CondaEnv[] {
    const envs = getCondaEnvsFromEnvironmentTxt().concat(getCondaEnvsFromKnownEnvLocations(condaBin));
    envs.sort();
    const distinctEnvs: CondaEnv[] = [];
    const locations = getKnownEnvLocations(condaBin);
    for (const env of envs) {
        let named = false;
        let name = '';
        for (const location of locations) {
            const envPath = path.resolve(env);
            const locationPath = path.resolve(location);
            if (envPath.startsWith(locationPath)) {
                named = true;
                name = path.relative(locationPath, envPath) || 'base';
                break;
            }
        }
        distinctEnvs.push({ named, name, path: env });
    }
    return distinctEnvs;
}

// interface EnvManager {
//     condaBinary: string;
//     condaVersion: string | undefined;
//     managerType: string;
// }

export function find(): LocatorResult | undefined {
    const condaBinary = findCondaBinary();
    if (!condaBinary) {
        return undefined;
    }
    const condaVersion = getCondaVersion(condaBinary);
    const manager: EnvManager = {
        executable_path: condaBinary,
        version: condaVersion,
        tool: EnvManagerType.Conda,
    };
    const envs = getDistinctCondaEnvs(condaBinary);
    if (envs.length === 0) {
        return {managers:[manager]};
    } else {
        const environments: PythonEnvironment[] = [];
        for (const env of envs) {
            const python_executable_path = findPythonBinaryPath(env.path);
            const environment: PythonEnvironment = {
                // named: env.named,
                name: env.name,
                env_path: env.path,
                python_executable_path,
                category: PythonEnvironmentCategory.Conda,
                version: getCondaPythonVersion(env.path),
                env_manager: manager,
                python_run_command: env.named
                    ? [condaBinary, 'run', '-n', env.name, 'python']
                    : [condaBinary, 'run', '-p', env.path, 'python'],
            };
            environments.push(environment);
        }
        return {environments};
    }
}
