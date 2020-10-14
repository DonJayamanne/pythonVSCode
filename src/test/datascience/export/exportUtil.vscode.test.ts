// Licensed under the MIT License.
// Copyright (c) Microsoft Corporation. All rights reserved.

// tslint:disable: no-var-requires no-require-imports no-invalid-this no-any
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Uri } from 'vscode';
import { IDisposable } from '../../../client/common/types';
import { ExportUtil } from '../../../client/datascience/export/exportUtil';
import { IExtensionTestApi } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS } from '../../constants';
import { closeActiveWindows, initialize } from '../../initialize';
import { createTemporaryNotebook } from '../notebook/helper';

suite('DataScience - Export Util', () => {
    let api: IExtensionTestApi;
    let testPdfIpynb: Uri;
    const testDisposables: IDisposable[] = [];
    suiteSetup(async function () {
        api = await initialize();
        // Export Util tests require jupyter to run. Otherwise can't
        // run any of our variable execution code
        if (!process.env.VSC_FORCE_REAL_JUPYTER) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
    });
    setup(async () => {
        // Create a new file (instead of modifying existing file).
        testPdfIpynb = Uri.file(
            await createTemporaryNotebook(
                path.join(EXTENSION_ROOT_DIR_FOR_TESTS, 'src', 'test', 'datascience', 'export', 'testPDF.ipynb'),
                testDisposables
            )
        );
    });
    teardown(() => closeActiveWindows(testDisposables));
    suiteTeardown(() => closeActiveWindows(testDisposables));
    test('Remove svgs from model', async () => {
        const exportUtil = api.serviceContainer.get<ExportUtil>(ExportUtil);

        await exportUtil.removeSvgs(testPdfIpynb);
        const model = JSON.parse(fs.readFileSync(testPdfIpynb.fsPath).toString()) as nbformat.INotebookContent;

        // make sure no svg exists in model
        const SVG = 'image/svg+xml';
        const PNG = 'image/png';
        for (const cell of model.cells) {
            const outputs = (cell.outputs || []) as nbformat.IOutput[];
            for (const output of outputs) {
                if (output.data) {
                    const data = output.data as nbformat.IMimeBundle;
                    if (PNG in data) {
                        // we only remove svgs if there is a pdf available
                        assert.equal(SVG in data, false);
                    }
                }
            }
        }
    });
});
