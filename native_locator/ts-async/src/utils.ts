/* eslint-disable max-classes-per-file */
/* eslint-disable consistent-return */
/* eslint-disable no-continue */
import * as fs from 'fs-extra';
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

export async function findPyvenvConfigPath(pythonExecutable: string): Promise<string | undefined> {
    const cfg = path.join(path.dirname(pythonExecutable), PYVENV_CONFIG_FILE);
    if (await fs.pathExists(cfg)) {
        return cfg;
    }

    const cfg2 = path.join(path.dirname(path.dirname(pythonExecutable)), PYVENV_CONFIG_FILE);
    if (await fs.pathExists(cfg2)) {
        return cfg2;
    }

    return undefined;
}

export async function findAndParsePyvenvCfg(pythonExecutable: string): Promise<PyEnvCfg | undefined> {
    const cfgPath = await findPyvenvConfigPath(pythonExecutable);
    if (!cfgPath || !(await fs.pathExists(cfgPath))) {
        return undefined;
    }

    const contents = await fs.readFile(cfgPath, 'utf8');
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

export async function getVersion(pythonExecutable: string): Promise<string | undefined> {
    const parentFolder = path.dirname(pythonExecutable);
    const pyenvCfg = await findAndParsePyvenvCfg(parentFolder);
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

export async function findPythonBinaryPath(envPath: string): Promise<string | undefined> {
    const pythonBinName = process.platform === 'win32' ? 'python.exe' : 'python';
    const paths = [
        path.join(envPath, 'bin', pythonBinName),
        path.join(envPath, 'Scripts', pythonBinName),
        path.join(envPath, pythonBinName),
    ];

    for (const p of paths) {
        if (await fs.pathExists(p)) {
            return p;
        }
    }

    return undefined;
}

export async function listPythonEnvironments(envPath: string): Promise<PythonEnv[] | undefined> {
    const pythonEnvs: PythonEnv[] = [];

    try {
        const venvDirs = await fs.readdir(envPath);
        await Promise.all(
            venvDirs.map(async (venvDir) => {
                const venvDirPath = path.join(envPath, venvDir);
                const stat = await fs.stat(venvDirPath);
                if (!stat.isDirectory()) {
                    return;
                }

                const executable = await findPythonBinaryPath(venvDirPath);
                if (executable) {
                    pythonEnvs.push({
                        executable,
                        path: venvDirPath,
                        version: await getVersion(executable),
                    });
                }
            }),
        );

        return pythonEnvs;
    } catch (error) {
        return undefined;
    }
}
