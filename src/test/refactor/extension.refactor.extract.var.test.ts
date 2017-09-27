import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';
import * as fs from 'fs-extra';
import { initialize, closeActiveWindows, IS_TRAVIS, wait } from './../initialize';
import { Position } from 'vscode';
import { extractVariable } from '../../client/providers/simpleRefactorProvider';
import { RefactorProxy } from '../../client/refactor/proxy';
import { getTextEditsFromPatch } from '../../client/common/editor';
import { MockOutputChannel } from './../mockClasses';

const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
const pythonSettings = settings.PythonSettings.getInstance();
const refactorSourceFile = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFile = path.join(__dirname, '..', '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');

interface RenameResponse {
    results: [{ diff: string }];
}

suite('Variable Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = vscode.commands.executeCommand;
    const options: vscode.TextEditorOptions = { cursorStyle: vscode.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode.TextEditorLineNumbersStyle.Off, tabSize: 4 };
    suiteSetup(done => {
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        initialize().then(() => done(), () => done());
    });
    suiteTeardown(() => {
        vscode.commands.executeCommand = oldExecuteCommand;
        return closeActiveWindows();
    });
    setup(async () => {
        if (fs.existsSync(refactorTargetFile)) {
            await wait(500);
            fs.unlinkSync(refactorTargetFile);
        }
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        await closeActiveWindows();
        (<any>vscode).commands.executeCommand = (cmd) => Promise.resolve();
    });
    teardown(() => {
        vscode.commands.executeCommand = oldExecuteCommand;
        return closeActiveWindows();
    });

    function testingVariableExtraction(shouldError: boolean, pythonSettings: settings.IPythonSettings, startPos: Position, endPos: Position) {
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile));
        let expectedTextEdits: vscode.TextEdit[];
        let ignoreErrorHandling = false;
        let mockTextDoc: vscode.TextDocument;
        const DIFF = '--- a/refactor.py\n+++ b/refactor.py\n@@ -232,7 +232,8 @@\n         sys.stdout.flush()\n \n     def watch(self):\n-        self._write_response("STARTED")\n+        myNewVariable = "STARTED"\n+        self._write_response(myNewVariable)\n         while True:\n             try:\n                 self._process_request(self._input.readline())\n';
        return new Promise<vscode.TextDocument>((resolve, reject) => {
            vscode.workspace.openTextDocument(refactorTargetFile).then(textDocument => {
                mockTextDoc = textDocument;
                expectedTextEdits = getTextEditsFromPatch(textDocument.getText(), DIFF);
                resolve();
            }, error => reject(error))
        })
            .then(() => proxy.extractVariable<RenameResponse>(mockTextDoc, 'myNewVariable', refactorTargetFile, rangeOfTextToExtract, options))
            .then(response => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail(null, null, 'Extraction should fail with an error', '');
                }
                let textEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
                assert.equal(response.results.length, 1, 'Invalid number of items in response');
                assert.equal(textEdits.length, expectedTextEdits.length, 'Invalid number of Text Edits');
                textEdits.forEach(edit => {
                    let foundEdit = expectedTextEdits.filter(item => item.newText === edit.newText && item.range.isEqual(edit.range));
                    assert.equal(foundEdit.length, 1, 'Edit not found');
                });
            }).catch(error => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error);
            });
    }

    test('Extract Variable', done => {
        let startPos = new vscode.Position(234, 29);
        let endPos = new vscode.Position(234, 38);
        testingVariableExtraction(false, pythonSettings, startPos, endPos).then(() => done(), done);
    });

    test('Extract Variable fails if whole string not selected', done => {
        let startPos = new vscode.Position(234, 20);
        let endPos = new vscode.Position(234, 38);
        testingVariableExtraction(true, pythonSettings, startPos, endPos).then(() => done(), done);
    });

    function testingVariableExtractionEndToEnd(shouldError: boolean, pythonSettings: settings.IPythonSettings, startPos: Position, endPos: Position) {
        let ch = new MockOutputChannel('Python');
        let textDocument: vscode.TextDocument;
        let textEditor: vscode.TextEditor;
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let ignoreErrorHandling = false;
        return vscode.workspace.openTextDocument(refactorTargetFile).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            editor.selections = [new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
            editor.selection = new vscode.Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
            textEditor = editor;
            return;
        }).then(() => {
            return extractVariable(EXTENSION_DIR, textEditor, rangeOfTextToExtract, ch, path.dirname(refactorTargetFile), pythonSettings).then(() => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                return textEditor.document.save();
            }).then(() => {
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                assert.equal(textDocument.lineAt(234).text.trim().indexOf('newvariable'), 0, 'New Variable not created');
                assert.equal(textDocument.lineAt(234).text.trim().endsWith('= "STARTED"'), true, 'Started Text Assigned to variable');
                assert.equal(textDocument.lineAt(235).text.indexOf('(newvariable') >= 0, true, 'New Variable not being used');
            }).catch(error => {
                if (ignoreErrorHandling) {
                    return Promise.reject(error);
                }
                if (shouldError) {
                    // Wait a minute this shouldn't work, what's going on
                    assert.equal(true, true, 'Error raised as expected');
                    return;
                }

                return Promise.reject(error);
            });
        }, error => {
            if (ignoreErrorHandling) {
                return Promise.reject(error);
            }
            if (shouldError) {
                // Wait a minute this shouldn't work, what's going on
                assert.equal(true, true, 'Error raised as expected');
            }
            else {
                assert.fail(error + '', null, 'Variable extraction failed\n' + ch.output, '');
                return Promise.reject(error);
            }
        });
    }

    // This test fails on linux (text document not getting updated in time)
    if (!IS_TRAVIS) {
        test('Extract Variable (end to end)', done => {
            let startPos = new vscode.Position(234, 29);
            let endPos = new vscode.Position(234, 38);
            testingVariableExtractionEndToEnd(false, pythonSettings, startPos, endPos).then(() => done(), done);
        });
    }

    test('Extract Variable fails if whole string not selected (end to end)', done => {
        let startPos = new vscode.Position(234, 20);
        let endPos = new vscode.Position(234, 38);
        testingVariableExtractionEndToEnd(true, pythonSettings, startPos, endPos).then(() => done(), done);
    });
});
