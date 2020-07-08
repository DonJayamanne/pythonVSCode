// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { nbformat } from '@jupyterlab/coreutils';
import { join } from 'path';
import { Uri } from 'vscode';
import { createDeferred } from '../../../client/common/utils/async';
import { hasTransientOutputForAnotherCell } from '../../../client/datascience/notebook/helpers/executionHelpers';
import { INotebookProvider } from '../../../client/datascience/types';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize, initializeTest } from '../../initialize';
import { canRunTests, closeNotebooksAndCleanUpAfterTests } from './helper';

// tslint:disable: no-any no-invalid-this
suite('DataScience - VSCode Notebook - Errors in Execution', function () {
    this.timeout(65_000);
    let api: IExtensionTestApi;
    suiteSetup(async function () {
        this.timeout(65_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
    });
    setup(async () => initializeTest());
    suiteTeardown(closeNotebooksAndCleanUpAfterTests);

    test('Simple Executionxxx', async () => {
        const templateIPynb = join(
            EXTENSION_ROOT_DIR_FOR_TESTS,
            'src',
            'test',
            'datascience',
            'notebook',
            'test.ipynb'
        );
        try {
            const notebookProvider = api.serviceContainer.get<INotebookProvider>(INotebookProvider);
            const nb = await notebookProvider.getOrCreateNotebook({
                identity: Uri.file(templateIPynb),
                disableUI: true,
                getOnly: false,
                resource: Uri.file(templateIPynb)
            });
            if (!nb) {
                // tslint:disable: no-console
                console.error('no nb');
                return;
            }
            nb.clear('1');
            const observable = nb.executeObservable('print(1)', templateIPynb, 0, '1', false);
            const deferred = createDeferred();
            observable?.subscribe(
                (cells) => {
                    console.error('Got output');
                    const rawCellOutput = cells
                        .filter((item) => item.id === '1')
                        .flatMap((item) => (item.data.outputs as unknown) as nbformat.IOutput[])
                        .filter((output) => !hasTransientOutputForAnotherCell(output));

                    // Set execution count, all messages should have it
                    if (
                        cells.length &&
                        'execution_count' in cells[0].data &&
                        typeof cells[0].data.execution_count === 'number'
                    ) {
                        const executionCount = cells[0].data.execution_count as number;
                        console.error(`Execution count = ${executionCount}`);
                    }

                    console.error(JSON.stringify(rawCellOutput));
                },
                (error: Partial<Error>) => {
                    console.error(`Failed`, error);
                    deferred.resolve();
                },
                () => {
                    console.error('Completed');
                    deferred.resolve();
                }
            );

            await deferred.promise;
        } catch (ex) {
            console.error('Crashed', ex);
        }
    });
});
