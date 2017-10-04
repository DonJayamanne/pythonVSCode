import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ShebangCodeLensProvider } from '../../client/providers/shebangCodeLensProvider'

import { initialize, IS_TRAVIS, closeActiveWindows } from '../initialize';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const filePlain = path.join(autoCompPath, 'plain.py');

var settings = vscode.workspace.getConfiguration("python");
const origPythonPath = settings.get("pythonPath");

suite("Shebang detection", () => {
    suiteSetup(async () => {
        await initialize();
    });

    suiteTeardown(async () => {
        await vscode.workspace.getConfiguration("python").update("pythonPath", origPythonPath);
    });

    teardown(() => closeActiveWindows());
    setup(() => {
        settings = vscode.workspace.getConfiguration("python");
    });

    test("Shebang available, CodeLens showing", async () => {
        await settings.update("pythonPath", "python");
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);

        assert.equal(codeLenses.length, 1, "No CodeLens available");
        let codeLens = codeLenses[0];
        assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
        assert.equal(codeLens.command.command, 'python.setShebangInterpreter');

    });

    test("Shebang available, CodeLens hiding", async () => {
        await settings.update("pythonPath", "/usr/bin/test");
        const editor = await openFile(fileShebang);
        const codeLenses = await setupCodeLens(editor);
        assert(!codeLenses, "CodeLens available although interpreters are equal");

    });

    test("Shebang missing, CodeLens hiding", async () => {
        const editor = await openFile(filePlain);
        const codeLenses = await setupCodeLens(editor);
        assert(!codeLenses, "CodeLens available although no shebang");

    });

    async function openFile(fileName: string) {
        const document = await vscode.workspace.openTextDocument(fileName);
        const editor = await vscode.window.showTextDocument(document);
        assert(vscode.window.activeTextEditor, 'No active editor');
        return editor;
    }

    async function setupCodeLens(editor: vscode.TextEditor) {
        const document = editor.document;
        const codeLensProvider = new ShebangCodeLensProvider();
        const codeLenses = await codeLensProvider.provideCodeLenses(document, null);
        return codeLenses;
    }
});