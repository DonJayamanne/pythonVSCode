import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { IS_WINDOWS } from '../../client/common/configSettings';
import { ShebangCodeLensProvider } from '../../client/providers/shebangCodeLensProvider';

import { initialize, IS_TRAVIS, closeActiveWindows } from '../initialize';
import { getFirstNonEmptyLineFromMultilineString } from '../../client/interpreter/helpers';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const fileShebangEnv = path.join(autoCompPath, 'shebangEnv.py');
const fileShebangInvalid = path.join(autoCompPath, 'shebangInvalid.py');
const filePlain = path.join(autoCompPath, 'plain.py');

var settings = vscode.workspace.getConfiguration('python');
const origPythonPath = settings.get('pythonPath');

suite('Shebang detection', () => {
    suiteSetup(() => initialize());
    suiteTeardown(() => vscode.workspace.getConfiguration('python').update('pythonPath', origPythonPath));
    teardown(async () => {
        await closeActiveWindows();
        await vscode.workspace.getConfiguration('python').update('pythonPath', origPythonPath);
    });

    test('Shebang available, CodeLens showing', async () => {
        await settings.update('pythonPath', 'someUnknownInterpreter');
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);

        assert.equal(codeLenses.length, 1, 'No CodeLens available');
        let codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command.command, 'python.setShebangInterpreter');

    });

    test('Shebang available, CodeLens hiding', async () => {
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        await settings.update('pythonPath', pythonPath);
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although interpreters are equal');

    });

    test('Shebang not available (invalid shebang)', async () => {
        const pythonPath = await getFullyQualifiedPathToInterpreter('python');
        await settings.update('pythonPath', pythonPath);
        const editor = await openFile(fileShebangInvalid);
        const codeLenses = await setupCodeLens(editor);
        assert.equal(codeLenses.length, 0, 'CodeLens available although shebang is invalid');
    });

    if (!IS_WINDOWS) {
        test('Shebang available, CodeLens showing with env', async () => {
            await settings.update('pythonPath', 'p1');
            const editor = await openFile(fileShebangEnv);
            const codeLenses = await setupCodeLens(editor);

            assert.equal(codeLenses.length, 1, 'No CodeLens available');
            let codeLens = codeLenses[0];
            assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
            assert.equal(codeLens.command.command, 'python.setShebangInterpreter');

        });

        test('Shebang available, CodeLens hiding with env', async () => {
            const pythonPath = await getFullyQualifiedPathToInterpreter('python');
            await settings.update('pythonPath', pythonPath);
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
