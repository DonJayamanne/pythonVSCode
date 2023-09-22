// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { PythonEnvKind } from '../../info';
import { BasicEnvInfo, IPythonEnvsIterator } from '../../locator';
import { FSWatchingLocator } from './fsWatchingLocator';
import { getInterpreterPathFromDir } from '../../../common/commonUtils';
import { getSubDirs } from '../../../common/externalDependencies';
import { getPyenvVersionsDir } from '../../../common/environmentManagers/pyenv';
import { traceError, traceVerbose } from '../../../../logging';

/**
 * Gets all the pyenv environments.
 *
 * Remarks: This function looks at the <pyenv dir>/versions directory and gets
 * all the environments (global or virtual) in that directory.
 */
async function* getPyenvEnvironments(): AsyncIterableIterator<BasicEnvInfo> {
    traceVerbose('Searching for pyenv environments');
    const pyenvVersionDir = getPyenvVersionsDir();

    const subDirs = getSubDirs(pyenvVersionDir, { resolveSymlinks: true });
    for await (const subDirPath of subDirs) {
        const interpreterPath = await getInterpreterPathFromDir(subDirPath);

        if (interpreterPath) {
            try {
                yield {
                    kind: PythonEnvKind.Pyenv,
                    executablePath: interpreterPath,
                };
            } catch (ex) {
                traceError(`Failed to process environment: ${interpreterPath}`, ex);
            }
        }
    }
    traceVerbose('Finished searching for pyenv environments');
}

export class PyenvLocator extends FSWatchingLocator {
    public readonly providerId: string = 'pyenv';

    constructor() {
        super(getPyenvVersionsDir, async () => PythonEnvKind.Pyenv);
    }

    // eslint-disable-next-line class-methods-use-this
    public doIterEnvs(): IPythonEnvsIterator<BasicEnvInfo> {
        return getPyenvEnvironments();
    }
}
