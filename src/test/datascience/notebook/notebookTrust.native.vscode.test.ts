// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-require-imports no-var-requires
import { assert } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { Uri } from 'vscode';
import { NotebookDocument } from '../../../../types/vscode-proposed';
import { IVSCodeNotebook } from '../../../client/common/application/types';
import { IConfigurationService, IDataScienceSettings, IDisposable } from '../../../client/common/types';
import { DataScience } from '../../../client/common/utils/localize';
import { INotebookStorageProvider } from '../../../client/datascience/notebookStorage/notebookStorageProvider';
import { ITrustService } from '../../../client/datascience/types';
import { createEventHandler, IExtensionTestApi, waitForCondition } from '../../common';
import { EXTENSION_ROOT_DIR_FOR_TESTS, initialize } from '../../initialize';
import { openNotebook } from '../helpers';
import { canRunTests, closeNotebooksAndCleanUpAfterTests, createTemporaryNotebook, hijackPrompt } from './helper';
// tslint:disable-next-line: no-var-requires no-require-imports
const vscodeNotebookEnums = require('vscode') as typeof import('vscode-proposed');

// tslint:disable: no-any no-invalid-this no-function-expression
suite('DataScience - VSCode Notebook - (Trust)', function () {
    this.timeout(15_000);
    const templateIPynbWithOutput = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutputForTrust.ipynb'
    );
    const templateIPynbWithoutOutput = path.join(
        EXTENSION_ROOT_DIR_FOR_TESTS,
        'src',
        'test',
        'datascience',
        'notebook',
        'withOutputForTrust.ipynb'
    );
    let api: IExtensionTestApi;
    const disposables: IDisposable[] = [];
    let oldTrustSetting: boolean;
    let dsSettings: IDataScienceSettings | undefined;
    let storageProvider: INotebookStorageProvider;
    let vscodeNotebook: IVSCodeNotebook;
    let trustService: ITrustService;
    suiteSetup(async function () {
        this.timeout(35_000);
        api = await initialize();
        if (!(await canRunTests())) {
            return this.skip();
        }
        const configService = api.serviceContainer.get<IConfigurationService>(IConfigurationService);
        storageProvider = api.serviceContainer.get<INotebookStorageProvider>(INotebookStorageProvider);
        trustService = api.serviceContainer.get<ITrustService>(ITrustService);
        vscodeNotebook = api.serviceContainer.get<IVSCodeNotebook>(IVSCodeNotebook);
        dsSettings = configService.getSettings().datascience;
        oldTrustSetting = dsSettings.alwaysTrustNotebooks;
        dsSettings.alwaysTrustNotebooks = false;
    });
    suiteTeardown(() => {
        if (dsSettings) {
            dsSettings.alwaysTrustNotebooks = oldTrustSetting === true;
        }
        return closeNotebooksAndCleanUpAfterTests(disposables);
    });

    function assertDocumentTrust(document: NotebookDocument, trusted: boolean, hasOutput: boolean) {
        assert.equal(document.metadata.cellEditable, trusted);
        assert.equal(document.metadata.cellRunnable, trusted);
        assert.equal(document.metadata.editable, trusted);
        assert.equal(document.metadata.runnable, trusted);

        document.cells.forEach((cell) => {
            assert.equal(cell.metadata.editable, trusted);
            if (cell.cellKind === vscodeNotebookEnums.CellKind.Code) {
                assert.equal(cell.metadata.runnable, trusted);
                if (hasOutput) {
                    // In our test all code cells have outputs.
                    if (trusted) {
                        assert.ok(cell.outputs.length, 'No output in trusted cell');
                    } else {
                        assert.lengthOf(cell.outputs, 0, 'Cannot have output in non-trusted notebook');
                    }
                }
            }
        });
        return true;
    }
    [true, false].forEach((withOutput) => {
        suite(`Test notebook ${withOutput ? 'with' : 'without'} outputxxx`, () => {
            let ipynbFile: Uri;
            setup(async () => {
                sinon.restore();
                dsSettings!.alwaysTrustNotebooks = true;
                // Don't use same file (due to dirty handling, we might save in dirty.)
                // Cuz we won't save to file, hence extension will backup in dirty file and when u re-open it will open from dirty.
                const templateFileToUse = withOutput ? templateIPynbWithOutput : templateIPynbWithoutOutput;
                ipynbFile = Uri.file(await createTemporaryNotebook(templateFileToUse, disposables));
            });
            teardown(async () => closeNotebooksAndCleanUpAfterTests(disposables));

            test('Opening an untrusted notebook', async () => {
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                const model = storageProvider.get(ipynbFile)!;
                assert.isFalse(model.isTrusted);
                assertDocumentTrust(vscodeNotebook.activeNotebookEditor?.document!, false, withOutput);
            });
            test('Prompted to trust an untrusted notebook and trusted', async () => {
                // Ensure we click `Yes` when prompted to trust the notebook.
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.trustNotebook() },
                    disposables
                );

                const trustSetEvent = createEventHandler(trustService, 'onDidSetNotebookTrust', disposables);

                // Open notebook & Confirm prompt was displayed.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForCondition(() => prompt.displayed, 10_000, 'Prompt to trust not displayed');
                prompt.clickButton();

                // Verify a document was trusted.
                await trustSetEvent.assertFiredAtLeast(1, 10_000);

                // Confirm the notebook is now trusted.
                const model = storageProvider.get(ipynbFile)!;
                assert.isTrue(model.isTrusted);
                await waitForCondition(
                    async () => assertDocumentTrust(vscodeNotebook.activeNotebookEditor?.document!, true, withOutput),
                    10_000,
                    'Not trusted'
                );
            });
            test('Prompted to trust an untrusted notebook and not trusted', async () => {
                // Ensure we click `No` when prompted to trust the notebook.
                const prompt = await hijackPrompt(
                    'showErrorMessage',
                    { exactMatch: DataScience.launchNotebookTrustPrompt() },
                    { text: DataScience.doNotTrustNotebook() },
                    disposables
                );

                // Open notebook & Confirm prompt was displayed.
                await openNotebook(api.serviceContainer, ipynbFile.fsPath, false);
                await waitForCondition(() => prompt.displayed, 10_000, 'Prompt to trust not displayed');
                prompt.clickButton();

                // Confirm the notebook is still untrusted.
                const model = storageProvider.get(ipynbFile)!;
                assert.isFalse(model.isTrusted);
                await waitForCondition(
                    async () => assertDocumentTrust(vscodeNotebook.activeNotebookEditor?.document!, false, withOutput),
                    10_000,
                    'Should not be trusted'
                );
            });
        });
    });
});
