// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as glob from 'glob';
import * as path from 'path';
import { parse, SemVer } from 'semver';
import { promisify } from 'util';
import { traceError, traceVerbose, traceWarning } from '../../client/common/logger';
import { BufferDecoder } from '../../client/common/process/decoder';
import { ProcessService } from '../../client/common/process/proc';
import { arePathsSame, getOSType, OSType } from '../common';
import { parseCondaEnvFileContents } from './condaHelper';
import { isCondaEnvironment } from './condaLocator';

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// tslint:disable-next-line:no-require-imports no-var-requires
const untildify: (value: string) => string = require('untildify');

// This glob pattern will match all of the following:
// ~/anaconda/bin/conda, ~/anaconda3/bin/conda, ~/miniconda/bin/conda, ~/miniconda3/bin/conda
// /usr/share/anaconda/bin/conda, /usr/share/anaconda3/bin/conda, /usr/share/miniconda/bin/conda, /usr/share/miniconda3/bin/conda

type CondaInfo = {
    envs?: string[];
    'sys.version'?: string;
    'sys.prefix'?: string;
    // eslint-disable-next-line camelcase
    python_version?: string;
    // eslint-disable-next-line camelcase
    default_prefix?: string;
    // eslint-disable-next-line camelcase
    conda_version?: string;
};
type CondaEnvironmentInfo = {
    name: string;
    path: string;
};

const condaGlobPathsForLinuxMac = [
    untildify('~/opt/*conda*/bin/conda'),
    '/opt/*conda*/bin/conda',
    '/usr/share/*conda*/bin/conda',
    untildify('~/*conda*/bin/conda')
];

const CondaLocationsGlob = `{${condaGlobPathsForLinuxMac.join(',')}}`;

// ...and for windows, the known default install locations:
const condaGlobPathsForWindows = [
    '/ProgramData/[Mm]iniconda*/Scripts/conda.exe',
    '/ProgramData/[Aa]naconda*/Scripts/conda.exe',
    untildify('~/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/[Aa]naconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Mm]iniconda*/Scripts/conda.exe'),
    untildify('~/AppData/Local/Continuum/[Aa]naconda*/Scripts/conda.exe')
];

// format for glob processing:
const CondaLocationsGlobWin = `{${condaGlobPathsForWindows.join(',')}}`;

/**
 * Return the path to the "conda file", if there is one (in known locations).
 * Note: For now we simply return the first one found.
 */
async function getCondaFileFromKnownLocations(): Promise<string> {
    const globPattern = getOSType() === OSType.Windows ? CondaLocationsGlobWin : CondaLocationsGlob;
    const condaFiles = await promisify(glob)(globPattern).catch<string[]>((failReason) => {
        traceWarning(
            'Default conda location search failed.',
            `Searching for default install locations for conda results in error: ${failReason}`
        );
        return [];
    });
    const validCondaFiles = condaFiles.filter((condaPath) => condaPath.length > 0);
    return validCondaFiles.length === 0 ? 'conda' : validCondaFiles[0];
}

let foundCondaFile: string | undefined;
export async function getCondaFile() {
    if (process.env.CI_PYTHON_CONDA_PATH) {
        return process.env.CI_PYTHON_CONDA_PATH as string;
    }
    if (foundCondaFile) {
        return foundCondaFile;
    }
    foundCondaFile = await getCondaFileFromKnownLocations();
    return foundCondaFile;
}

let condaInfo: CondaInfo | undefined;
async function getCondaInfo(): Promise<CondaInfo | undefined> {
    if (condaInfo) {
        return condaInfo;
    }
    try {
        const processService = new ProcessService(new BufferDecoder());
        condaInfo = await processService
            .exec(await getCondaFile(), ['info', '--json'])
            .then((output) => JSON.parse(output.stdout));

        return condaInfo;
    } catch (ex) {
        // Failed because either:
        //   1. conda is not installed.
        //   2. `conda info --json` has changed signature.
    }
}

let condaVersion: SemVer | undefined;
async function getCondaVersion(): Promise<SemVer | undefined> {
    if (condaVersion) {
        return condaVersion;
    }
    const processService = new ProcessService(new BufferDecoder());
    const info = await getCondaInfo();
    let versionString: string | undefined;
    if (info && info.conda_version) {
        versionString = info.conda_version;
    } else {
        const stdOut = await processService
            .exec(await getCondaFile(), ['--version'], {})
            .then((result) => result.stdout.trim())
            .catch<string | undefined>(() => undefined);

        versionString = stdOut && stdOut.startsWith('conda ') ? stdOut.substring('conda '.length).trim() : stdOut;
    }
    if (!versionString) {
        return;
    }
    const version = parse(versionString, true);
    if (version) {
        condaVersion = version;
        return version;
    }
    // Use a bogus version, at least to indicate the fact that a version was returned.
    traceWarning(`Unable to parse Version of Conda, ${versionString}`);
    return new SemVer('0.0.1');
}

let condaEnvironments: CondaEnvironmentInfo[] | undefined;
async function getCondaEnvironments(): Promise<CondaEnvironmentInfo[] | undefined> {
    if (condaEnvironments) {
        return condaEnvironments;
    }

    try {
        const processService = new ProcessService(new BufferDecoder());
        const condaFile = await getCondaFile();
        let envInfo = await processService.exec(condaFile, ['env', 'list']).then((output) => output.stdout);
        traceVerbose(`Conda Env List ${envInfo}}`);
        if (!envInfo) {
            traceVerbose('Conda env list failure, attempting path additions.');
            // Try adding different folders to the path. Miniconda fails to run
            // without them.
            const baseFolder = path.dirname(path.dirname(condaFile));
            const binFolder = path.join(baseFolder, 'bin');
            const condaBinFolder = path.join(baseFolder, 'condabin');
            const libaryBinFolder = path.join(baseFolder, 'library', 'bin');
            const newEnv = process.env;
            newEnv.PATH = `${binFolder};${condaBinFolder};${libaryBinFolder};${newEnv.PATH}`;
            traceVerbose(`Attempting new path for conda env list: ${newEnv.PATH}`);
            envInfo = await processService
                .exec(condaFile, ['env', 'list'], { env: newEnv })
                .then((output) => output.stdout);
        }
        condaEnvironments = parseCondaEnvFileContents(envInfo);
        return condaEnvironments;
    } catch (ex) {
        condaEnvironments = [];
        // Failed because either:
        //   1. conda is not installed.
        //   2. `conda env list has changed signature.
        traceError('Failed to get conda environment list from conda', ex);
    }
}

/**
 * Return (env name, interpreter filename) for the interpreter.
 */
export async function getCondaEnvironment(
    interpreterPath: string
): Promise<{ name: string; path: string } | undefined> {
    const isCondaEnv = await isCondaEnvironment(interpreterPath);
    if (!isCondaEnv) {
        return;
    }
    const environments = await getCondaEnvironments();
    const dir = path.dirname(interpreterPath);

    // If interpreter is in bin or Scripts, then go up one level
    const subDirName = path.basename(dir);
    const goUpOnLevel = ['BIN', 'SCRIPTS'].indexOf(subDirName.toUpperCase()) !== -1;
    const interpreterPathToMatch = goUpOnLevel ? path.join(dir, '..') : dir;

    // From the list of conda environments find this dir.
    const matchingEnvs = Array.isArray(environments)
        ? environments.filter((item) => arePathsSame(item.path, interpreterPathToMatch))
        : [];

    if (matchingEnvs.length > 0) {
        return { name: matchingEnvs[0].name, path: interpreterPathToMatch };
    }

    // If still not available, then the user created the env after starting vs code.
    // The only solution is to get the user to re-start vscode.
}

let condaIsAvailable: boolean | undefined;
/**
 * Is there a conda install to use?
 */
export async function isCondaAvailable(): Promise<boolean> {
    if (typeof condaIsAvailable === 'boolean') {
        return condaIsAvailable;
    }
    try {
        const version = await getCondaVersion();
        condaIsAvailable = version !== undefined;
    } catch {
        condaIsAvailable = false;
    }
    return condaIsAvailable;
}
