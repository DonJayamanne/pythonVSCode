/// <reference path="../../node_modules/@types/mocha/index.d.ts" />
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import {TextDocument, TextLine, Position, Range} from 'vscode';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs-extra';
import {initialize, closeActiveWindows} from './initialize';
import {execPythonFile} from '../client/common/utils';
import {extractVariable, extractMethod} from '../client/providers/simpleRefactorProvider';
import {RefactorProxy} from '../client/refactor/proxy';
import {getTextEditsFromPatch} from '../client/common/editor';
import * as child_process from 'child_process';

let EXTENSION_DIR = path.join(__dirname, '..', '..');
let pythonSettings = settings.PythonSettings.getInstance();

const refactorSourceFile = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFile = path.join(__dirname, '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
let isPython3 = true;
let isTRAVIS = (process.env['TRAVIS'] + '') === 'true';

interface RenameResponse {
    results: [{ diff: string }];
}

class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    name: string;
    output: string;
    append(value: string) {
        this.output += value;
    }
    appendLine(value: string) { this.append(value); this.append('\n'); }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void { }
    hide() { }
    dispose() { }
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
            { position: new vscode.Position(234, 20), offset: 8191 },
            { position: new vscode.Position(234, 29), offset: 8200 },
            { position: new vscode.Position(234, 38), offset: 8209 }
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

suiteSetup(done => {
    fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
    initialize().then(() => {
        new Promise<string>(resolve => {
            // Support for travis
            let version = process.env['TRAVIS_PYTHON_VERSION'];
            if (typeof version === 'string') {
                return resolve(version);
            }
            // Support for local tests
            execPythonFile('python', ['--version'], __dirname, true).then(resolve);
        }).then(version => {
            isPython3 = version.indexOf('3.') >= 0;
            done();
        });
    });
});

suiteTeardown(done => {
    // deleteFile(targetPythonFileToLint).then(done, done);
    done();
});

suite('Variable Extraction', () => {
    setup(() => {
        if (fs.existsSync(refactorTargetFile)) {
            fs.unlinkSync(refactorTargetFile);
        }
        fs.copySync(refactorSourceFile, refactorTargetFile, { clobber: true });
    });
    teardown(done => {
        closeActiveWindows().then(() => {
            setTimeout(function () {
                done();
            }, 1000);
        });
    });

    function testingVariableExtraction(shouldError: boolean, pythonSettings: settings.IPythonSettings, startPos: Position, endPos: Position) {
        let ch = new MockOutputChannel('Python');
        let rangeOfTextToExtract = new vscode.Range(startPos, endPos);
        let proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile));
        let mockTextDoc = new MockTextDocument(refactorTargetFile);
        let ignoreErrorHandling = false;

        const DIFF = '--- a/refactor.py\n+++ b/refactor.py\n@@ -232,7 +232,8 @@\n         sys.stdout.flush()\n \n     def watch(self):\n-        self._write_response("STARTED")\n+        myNewVariable = "STARTED"\n+        self._write_response(myNewVariable)\n         while True:\n             try:\n                 self._process_request(self._input.readline())\n';
        let expectedTextEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);

        return proxy.extractVariable<RenameResponse>(mockTextDoc, 'myNewVariable', refactorTargetFile, rangeOfTextToExtract)
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

    test('Extract Variable will try to find Python 2.x', done => {
        let startPos = new vscode.Position(234, 29);
        let endPos = new vscode.Position(234, 38);
        let clonedSettings = JSON.parse(JSON.stringify(pythonSettings));
        testingVariableExtraction(false, clonedSettings, startPos, endPos).then(() => done(), done);
    });

    // test('Extract Variable will not work in Python 3.x', done => {
    //     let startPos = new vscode.Position(234, 29);
    //     let endPos = new vscode.Position(234, 38);
    //     let clonedSettings = JSON.parse(JSON.stringify(pythonSettings));
    //     clonedSettings.pythonPath = 'python3';
    //     testingVariableExtraction(true, clonedSettings, startPos, endPos).then(() => done(), done);
    // });

    if (!isTRAVIS) {
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

        test('Extract Variable (end to end)', done => {
            let startPos = new vscode.Position(234, 29);
            let endPos = new vscode.Position(234, 38);
            testingVariableExtractionEndToEnd(false, pythonSettings, startPos, endPos).then(() => done(), done);
        });

        test('Extract Variable fails if whole string not selected (end to end)', done => {
            let startPos = new vscode.Position(234, 20);
            let endPos = new vscode.Position(234, 38);
            testingVariableExtractionEndToEnd(true, pythonSettings, startPos, endPos).then(() => done(), done);
        });

        test('Extract Variable will try to find Python 2.x (end to end)', done => {
            let startPos = new vscode.Position(234, 29);
            let endPos = new vscode.Position(234, 38);
            let clonedSettings = JSON.parse(JSON.stringify(pythonSettings));
            testingVariableExtractionEndToEnd(false, clonedSettings, startPos, endPos).then(() => done(), done);
        });

        // test('Extract Variable will not work in Python 3.x (end to end)', done => {
        //     let startPos = new vscode.Position(234, 29);
        //     let endPos = new vscode.Position(234, 38);
        //     let clonedSettings = JSON.parse(JSON.stringify(pythonSettings));
        //     clonedSettings.pythonPath = 'python3';
        //     testingVariableExtractionEndToEnd(true, clonedSettings, startPos, endPos).then(() => done(), done);
        // });
    }
});
