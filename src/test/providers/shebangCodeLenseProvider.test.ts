import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { ShebangCodeLensProvider } from '../../client/providers/shebangCodeLensProvider'

import { initialize, IS_TRAVIS, closeActiveWindows } from '../initialize';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'shebang');
const fileShebang = path.join(autoCompPath, 'shebang.py');
const filePlain = path.join(autoCompPath, 'plain.py');

var settings = vscode.workspace.getConfiguration("python");

suite("Shebang detection", () => {
    suiteSetup(async () => {
        await initialize();
    });

    teardown(() => closeActiveWindows());
    setup(() => {
        settings = vscode.workspace.getConfiguration("python");
    });

    test("Shebang available, CodeLens showing", done => {
        settings.update("pythonPath", "python");

        openFile(fileShebang).then(editor => {
            let document = editor.document;
            let codeLensProvider = new ShebangCodeLensProvider();
            
            codeLensProvider.provideCodeLenses(document, null).then(lenses => {
                assert.equal(lenses.length, 1, "No CodeLens available");
                let codeLens = lenses[0];

                assert(codeLens.range.isSingleLine, 'Invalid CodeLens Range');
                assert.equal(codeLens.command.command, 'python.setShebangInterpreter');
            });
        }).then(done, done);
    });

    test("Shebang available, CodeLens hiding", done => {
        settings.update("pythonPath", "/usr/bin/test");

        openFile(fileShebang).then(editor => {
            let document = editor.document;
            let codeLensProvider = new ShebangCodeLensProvider();
            
            codeLensProvider.provideCodeLenses(document, null).then(lenses => {
                assert(!lenses, "CodeLens available although interpreters are equal");
            });
        }).then(done, done);
    });

    test("Shebang missing, CodeLens hiding", done => {
        openFile(filePlain).then(editor => {
            let document = editor.document;
            let codeLensProvider = new ShebangCodeLensProvider();

            codeLensProvider.provideCodeLenses(document, null).then(lenses => {
                assert(!lenses, "CodeLens available although no shebang");
            });
        }).then(done, done);
    });

    function openFile(fileName) {
        return vscode.workspace.openTextDocument(fileName).then(document => {
            const textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            return editor;
        });
    }
});