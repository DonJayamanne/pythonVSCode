// Place this right on top
import { initialize, closeActiveWindows, IS_TRAVIS, setPythonExecutable } from './initialize';
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { TextLine, Position, Range } from 'vscode';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs-extra';
import { extractMethod } from '../client/providers/simpleRefactorProvider';
import { RefactorProxy } from '../client/refactor/proxy';
import { getTextEditsFromPatch } from '../client/common/editor';
import { MockOutputChannel } from './mockClasses';

let EXTENSION_DIR = path.join(__dirname, '..', '..');
let pythonSettings = settings.PythonSettings.getInstance();
const disposable = setPythonExecutable(pythonSettings);

const refactorSourceFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFile = path.join(__dirname, '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');

interface RenameResponse {
    results: [{ diff: string }];
}

class MockTextDocument implements vscode.TextDocument {
    uri: vscode.Uri;
    fileName: string;
    isUntitled: boolean;
    languageId: string;
    version: number;
    isDirty: boolean;
    offsets: [{ position: Position, offset: number }];
    constructor(private sourceFile: string) {
        this.lineCount = fs.readFileSync(this.sourceFile, 'utf8').split(/\r?\n/g).length;
        this.offsets = [
            { position: new vscode.Position(239, 30), offset: 8376 },
            { position: new vscode.Position(239, 0), offset: 8346 },
            { position: new vscode.Position(241, 35), offset: 8519 }
        ];
    }
    save(): Thenable<boolean> {
        return Promise.resolve(true);
    }
    lineCount: number;
    lineAt(position: Position | number): TextLine {
        let lineNumber: number = position as number;
        if ((position as Position).line) {
            lineNumber = (position as Position).line;
        }
        let line = fs.readFileSync(this.sourceFile, 'utf8').split(/\r?\n/g)[lineNumber];

        return <TextLine>{ isEmptyOrWhitespace: line.trim().length > 0 };
    }
    offsetAt(position: Position): number {
        return this.offsets.filter(item => item.position.isEqual(position))[0].offset;
    }
    positionAt(offset: number): Position {
        return null;
    }
    getText(range?: Range): string {
        return fs.readFileSync(this.sourceFile, 'utf8');
    }
    getWordRangeAtPosition(position: Position): Range {
        return null;
    }
    validateRange(range: Range): Range {
        return null;
    }
    validatePosition(position: Position): Position {
        return null;
    }
}

suite('Method Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = vscode.commands.executeCommand;
    const options: vscode.TextEditorOptions = { cursorStyle: vscode.TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: vscode.TextEditorLineNumbersStyle.Off, tabSize: 4 };

    suiteSetup(done => {
        fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
        initialize().then(() => done(), () => done());
    });
    suiteTeardown(done => {
        disposable.dispose();
        vscode.commands.executeCommand = oldExecuteCommand;
        closeActiveWindows().then(() => done(), () => done());
    });
    setup(done => {
        if (fs.existsSync(refactorTargetFile)) {
            fs.unlinkSync(refactorTargetFile);
        }
        fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
        closeActiveWindows().then(() => {
            (<any>vscode).commands.executeCommand = (cmd) => Promise.resolve();
            done();
        }).catch(done);
    });
    teardown(done => {
        vscode.commands.executeCommand = oldExecuteCommand;
        closeActiveWindows().then(() => done(), () => done());
    });

    function testingMethodExtraction(shouldError: boolean, pythonSettings: settings.IPythonSettings, startPos: Position, endPos: Position) {
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile));
        let mockTextDoc = new MockTextDocument(refactorTargetFile);
        let ignoreErrorHandling = false;

        const DIFF = `--- a/refactor.py\n+++ b/refactor.py\n@@ -237,9 +237,12 @@\n             try:\n                 self._process_request(self._input.readline())\n             except Exception as ex:\n-                message = ex.message + '  \\n' + traceback.format_exc()\n-                sys.stderr.write(str(len(message)) + ':' + message)\n-                sys.stderr.flush()\n+                self.myNewMethod(ex)\n+\n+    def myNewMethod(self, ex):\n+        message = ex.message + '  \\n' + traceback.format_exc()\n+        sys.stderr.write(str(len(message)) + ':' + message)\n+        sys.stderr.flush()\n \n if __name__ == '__main__':\n     RopeRefactoring().watch()\n`;
        let expectedTextEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
        return proxy.extractMethod<RenameResponse>(mockTextDoc, 'myNewMethod', refactorTargetFile, rangeOfTextToExtract, options)
            .then(response => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
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

    test('Extract Method', done => {
        let startPos = new vscode.Position(239, 0);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtraction(false, pythonSettings, startPos, endPos).then(() => done(), done);
    });

    test('Extract Method will fail if complete statements are not selected', done => {
        let startPos = new vscode.Position(239, 30);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtraction(true, pythonSettings, startPos, endPos).then(() => done(), done);
    });

    function testingMethodExtractionEndToEnd(shouldError: boolean, pythonSettings: settings.IPythonSettings, startPos: Position, endPos: Position) {
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
            return extractMethod(EXTENSION_DIR, textEditor, rangeOfTextToExtract, ch, path.dirname(refactorTargetFile), pythonSettings).then(() => {
                if (shouldError) {
                    ignoreErrorHandling = true;
                    assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
                }
                return textEditor.document.save();
            }).then(() => {
                assert.equal(ch.output.length, 0, 'Output channel is not empty');
                assert.equal(textDocument.lineAt(241).text.trim().indexOf('def newmethod'), 0, 'New Method not created');
                assert.equal(textDocument.lineAt(239).text.trim().startsWith('self.newmethod'), true, 'New Method not being used');
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
                assert.fail(error + '', null, 'Method extraction failed\n' + ch.output, '');
                return Promise.reject(error);
            }
        });
    }

    // This test fails on linux (text document not getting updated in time)
    if (!IS_TRAVIS) {
        test('Extract Method (end to end)', done => {
            let startPos = new vscode.Position(239, 0);
            let endPos = new vscode.Position(241, 35);
            testingMethodExtractionEndToEnd(false, pythonSettings, startPos, endPos).then(() => done(), done);
        });
    }

    test('Extract Method will fail if complete statements are not selected', done => {
        let startPos = new vscode.Position(239, 30);
        let endPos = new vscode.Position(241, 35);
        testingMethodExtractionEndToEnd(true, pythonSettings, startPos, endPos).then(() => done(), done);
    });
});