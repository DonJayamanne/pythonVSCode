/* eslint-disable no-return-await */
/* eslint-disable no-continue */
/* eslint-disable no-useless-return */
/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs-extra';
import * as path from 'path';
import { Locator, LocatorResult } from './locator';
import { PythonEnvironment, PythonEnvironmentCategory } from './messaging';
import { PythonEnv } from './utils';

export async function isSymlinkedPythonExecutable(file: string): Promise<string | undefined> {
    const name = path.basename(file);
    if (!name.startsWith('python') || name.endsWith('-config') || name.endsWith('-build')) {
        return undefined;
    }
    const metadata = await fs.lstat(file);
    if (metadata.isFile() || !metadata.isSymbolicLink()) {
        return undefined;
    }
    return await fs.realpath(file);
}

export async function find(): Promise<LocatorResult | undefined> {
    const homebrewPrefix = process.env.HOMEBREW_PREFIX;
    if (!homebrewPrefix) {
        return undefined;
    }
    const homebrewPrefixBin = path.join(homebrewPrefix, 'bin');
    const reported = new Set<string>();
    const pythonRegex = new RegExp(/\/(\d+\.\d+\.\d+)\//);
    const environments: PythonEnvironment[] = [];
    const dirs = await fs.readdir(homebrewPrefixBin);
    await Promise.all(
        dirs.map(async (file) => {
            const exe = await isSymlinkedPythonExecutable(path.join(homebrewPrefixBin, file));
            if (exe) {
                const pythonVersion = exe;
                const version = pythonRegex.exec(pythonVersion)?.[1];
                if (reported.has(exe)) {
                    return;
                }
                reported.add(exe);
                const env: PythonEnvironment = {
                    python_executable_path: exe,
                    category: PythonEnvironmentCategory.Homebrew,
                    version,
                    python_run_command: [exe],
                };
                environments.push(env);
            }
        }),
    );
    if (environments.length === 0) {
        return undefined;
    }
    return { environments };
}
