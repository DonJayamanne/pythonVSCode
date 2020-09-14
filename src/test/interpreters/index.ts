// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { traceError } from '../../client/common/logger';
import { BufferDecoder } from '../../client/common/process/decoder';
import { PythonEnvInfo } from '../../client/common/process/internal/scripts';
import { ProcessService } from '../../client/common/process/proc';
import { PythonEnvironment } from '../../client/pythonEnvironments/info';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../constants';
import { isCondaEnvironment } from './condaLocator';
import { getCondaEnvironment, getCondaFile, isCondaAvailable } from './condaService';
import { parsePythonVersion } from './pythonVersion';

const SCRIPTS_DIR = path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'pythonFiles');

export async function getInterpreterInfo(pythonPath: string): Promise<PythonEnvironment | undefined> {
    const cli = await getPythonCli(pythonPath);
    const processService = new ProcessService(new BufferDecoder());
    const argv = [...cli, path.join(SCRIPTS_DIR, 'interpreterInfo.py')];
    // Concat these together to make a set of quoted strings
    const quoted = argv.reduce((p, c) => (p ? `${p} "${c}"` : `"${c.replace('\\', '\\\\')}"`), '');

    const result = await processService.shellExec(quoted, { timeout: 1_500 });
    if (result.stderr) {
        traceError(`Failed to parse interpreter information for ${argv} stderr: ${result.stderr}`);
        return;
    }
    const json: PythonEnvInfo = JSON.parse(result.stdout.trim());
    const rawVersion = `${json.versionInfo.slice(0, 3).join('.')}-${json.versionInfo[3]}`;
    return {
        path: pythonPath,
        version: parsePythonVersion(rawVersion),
        sysVersion: json.sysVersion,
        sysPrefix: json.sysPrefix
    };
}

async function getPythonCli(pythonPath: string) {
    const isConda = await isCondaEnvironment(pythonPath);
    if (isConda) {
        try {
            const available = isCondaAvailable();
            if (!available) {
                throw new Error('No conda but using conda interpreter');
            }
            const condaInfo = await getCondaEnvironment(pythonPath);
            const runArgs = ['run'];
            if (!condaInfo) {
                throw new Error('No conda info');
            } else if (condaInfo.name === '') {
                runArgs.push('-p', condaInfo.path);
            } else {
                runArgs.push('-n', condaInfo.name);
            }

            const condaFile = await getCondaFile();
            return [condaFile, ...runArgs, 'python'];
        } catch {
            // Noop.
        }
        traceError('Using Conda Interpreter, but no conda');
    }
    return [pythonPath];
}
