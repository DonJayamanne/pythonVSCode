/* eslint-disable max-classes-per-file */
/* eslint-disable consistent-return */
/* eslint-disable no-continue */
import * as fs from 'fs';
import * as path from 'path';
// import { execSync } from 'child_process';

export class PythonEnv {
    executable: string;

    path?: string;

    version?: string;

    constructor(executable: string, envPath: string | undefined, version: string | undefined) {
        this.executable = executable;
        this.path = envPath;
        this.version = version;
    }
}

export class PyEnvCfg {
    version: string;

    constructor(version: string) {
        this.version = version;
    }
}

const PYVENV_CONFIG_FILE = 'pyvenv.cfg';

export function findPyvenvConfigPath(pythonExecutable: string): string | undefined {
    const cfg = path.join(path.dirname(pythonExecutable), PYVENV_CONFIG_FILE);
    if (fs.existsSync(cfg)) {
        return cfg;
    }

    const cfg2 = path.join(path.dirname(path.dirname(pythonExecutable)), PYVENV_CONFIG_FILE);
    if (fs.existsSync(cfg2)) {
        return cfg2;
    }

    return undefined;
}

export function findAndParsePyvenvCfg(pythonExecutable: string): PyEnvCfg | undefined {
    const cfgPath = findPyvenvConfigPath(pythonExecutable);
    if (!cfgPath || !fs.existsSync(cfgPath)) {
        return undefined;
    }

    const contents = fs.readFileSync(cfgPath, 'utf8');
    const versionRegex = /^version\s*=\s*(\d+\.\d+\.\d+)$/m;
    const versionInfoRegex = /^version_info\s*=\s*(\d+\.\d+\.\d+.*)$/m;

    for (const line of contents.split('\n')) {
        if (!line.includes('version')) {
            continue;
        }

        const versionMatch = line.match(versionRegex);
        if (versionMatch && versionMatch[1]) {
            return new PyEnvCfg(versionMatch[1]);
        }

        const versionInfoMatch = line.match(versionInfoRegex);
        if (versionInfoMatch && versionInfoMatch[1]) {
            return new PyEnvCfg(versionInfoMatch[1]);
        }
    }

    return undefined;
}

export function getVersion(pythonExecutable: string): string | undefined {
    const parentFolder = path.dirname(pythonExecutable);
    const pyenvCfg = findAndParsePyvenvCfg(parentFolder);
    if (pyenvCfg) {
        return pyenvCfg.version;
    }

    // try {
    //     const output = execSync(`${pythonExecutable} -c "import sys; print(sys.version)"`).toString();
    //     const trimmedOutput = output.trim();
    //     const version = trimmedOutput.split(' ')[0];
    //     return version;
    // } catch (error) {
    //     return undefined;
    // }
}

export function findPythonBinaryPath(envPath: string): string | undefined {
    const pythonBinName = process.platform === 'win32' ? 'python.exe' : 'python';
    const paths = [
        path.join(envPath, 'bin', pythonBinName),
        path.join(envPath, 'Scripts', pythonBinName),
        path.join(envPath, pythonBinName),
    ];

    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return undefined;
}

export function listPythonEnvironments(envPath: string): PythonEnv[] | undefined {
    const pythonEnvs: PythonEnv[] = [];

    try {
        const venvDirs = fs.readdirSync(envPath);
        for (const venvDir of venvDirs) {
            const venvDirPath = path.join(envPath, venvDir);
            if (!fs.statSync(venvDirPath).isDirectory()) {
                continue;
            }

            const executable = findPythonBinaryPath(venvDirPath);
            if (executable) {
                pythonEnvs.push({
                    executable,
                    path: venvDirPath,
                    version: getVersion(executable),
                });
            }
        }

        return pythonEnvs;
    } catch (error) {
        return undefined;
    }
}
