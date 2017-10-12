import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { IS_WINDOWS } from '../../client/common/configSettings';
import { rootWorkspaceUri, updateSetting } from '../common';
import { ShebangCodeLensProvider } from '../../client/providers/shebangCodeLensProvider';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const fileShebangEnv = path.join(autoCompPath, 'shebangEnv.py');
const fileShebangInvalid = path.join(autoCompPath, 'shebangInvalid.py');
const filePlain = path.join(autoCompPath, 'plain.py');

suite('Shebang detection', () => {
    suiteSetup(() => initialize());
    suiteTeardown(async () => {
        await initialize();
        await closeActiveWindows();
    });
    setup(() => initializeTest());

    test('Shebang available, CodeLens showing', async () => {
        const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
        await updateSetting('pythonPath', 'someUnknownInterpreter', rootWorkspaceUri, configTarget);
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);

        assert.equal(codeLenses.length, 1, 'No CodeLens available');
        let codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command.command, 'python.setShebangInterpreter');
    });

    test('Shebang available, CodeLens hiding', async () => {
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
        await updateSetting('pythonPath', pythonPath, rootWorkspaceUri, configTarget);
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');

    });

    test('Shebang not available (invalid shebang)', async () => {
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
        await updateSetting('pythonPath', pythonPath, rootWorkspaceUri, configTarget);
        const editor = await openFile(fileShebangInvalid);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although shebang is invalid');
    });

    if (!IS_WINDOWS) {
        test('Shebang available, CodeLens showing with env', async () => {
            const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
            await updateSetting('pythonPath', 'p1', rootWorkspaceUri, configTarget);
            const editor = await openFile(fileShebangEnv);
            const codeLenses = await setupCodeLens(editor);

            assert.equal(codeLenses.length, 1, 'No CodeLens available');
            let codeLens = codeLenses[0];
            assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
            assert.equal(codeLens.command.command, 'python.setShebangInterpreter');

        });

        test('Shebang available, CodeLens hiding with env', async () => {
            const pythonPath = await getFullyQualifiedPathToInterpreter('python');
            const configTarget = IS_MULTI_ROOT_TEST ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace;
            await updateSetting('pythonPath', pythonPath, rootWorkspaceUri, configTarget);
            const editor = await openFile(fileShebangEnv);
            const codeLenses = await setupCodeLens(editor);
            assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');
        });
    }

    test('Shebang missing, CodeLens hiding', async () => {
        const editor = await openFile(filePlain);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although no shebang');
    });

    async function openFile(fileName: string) {
        const document = await vscode.workspace.openTextDocument(fileName);
        const editor = await vscode.window.showTextDocument(document);
        assert(vscode.window.activeTextEditor, 'No active editor');
        return editor;
    }
    async function getFullyQualifiedPathToInterpreter(pythonPath: string) {
        return new Promise<string>(resolve => {
            child_process.execFile(pythonPath, ['-c', 'import sys;print(sys.executable)'], (_, stdout) => {
                resolve(getFirstNonEmptyLineFromMultilineString(stdout));
            });
        }).catch(() => undefined);
    }

    async function setupCodeLens(editor: vscode.TextEditor) {
        const document = editor.document;
        const codeLensProvider = new ShebangCodeLensProvider();
        const codeLenses = await codeLensProvider.provideCodeLenses(document, null);
        return codeLenses;
    }
});
