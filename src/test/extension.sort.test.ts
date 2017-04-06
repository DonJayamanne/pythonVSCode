
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, PYTHON_PATH, IS_TRAVIS, closeActiveWindows } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { PythonImportSortProvider } from '../client/providers/importSortProvider';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs';
import { EOL } from 'os';

const pythonSettings = settings.PythonSettings.getInstance();
const fileToFormatWithoutConfig = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'noconfig', 'before.py');
const originalFileToFormatWithoutConfig = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'noconfig', 'original.py');
const fileToFormatWithConfig = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig', 'before.py');
const originalFileToFormatWithConfig = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig', 'original.py');
const fileToFormatWithConfig1 = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig', 'before.1.py');
const originalFileToFormatWithConfig1 = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig', 'original.1.py');
const extensionDir = path.join(__dirname, '..', '..');

suite('Sorting', () => {
    suiteSetup(done => {
        initialize().then(() => {
            pythonSettings.pythonPath = PYTHON_PATH;
        }).then(done, done);
    });
    suiteTeardown(done => {
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        closeActiveWindows().then(done).catch(done);
    });
    setup(done => {
        pythonSettings.sortImports.args = [];
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        closeActiveWindows().then(done).catch(done);
    });

    test('Without Config', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileToFormatWithoutConfig).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            textEditor = editor;
            assert(vscode.window.activeTextEditor, 'No active editor');
            const sorter = new PythonImportSortProvider();
            return sorter.sortImports(extensionDir, textDocument);
        }).then(edits => {
            assert.equal(edits.filter(value => value.newText === EOL && value.range.isEqual(new vscode.Range(2, 0, 2, 0))).length, 1, 'EOL not found');
            assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new vscode.Range(3, 0, 4, 0))).length, 1, '"" not found');
            assert.equal(edits.filter(value => value.newText === `from rope.base import libutils${EOL}from rope.refactor.extract import ExtractMethod, ExtractVariable${EOL}from rope.refactor.rename import Rename${EOL}` && value.range.isEqual(new vscode.Range(6, 0, 6, 0))).length, 1, 'Text not found');
            assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new vscode.Range(13, 0, 18, 0))).length, 1, '"" not found');
        }).then(done, done);
    });

    test('Without Config (via Command)', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        let originalContent = '';
        vscode.workspace.openTextDocument(fileToFormatWithoutConfig).then(document => {
            textDocument = document;
            originalContent = textDocument.getText();
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            return vscode.commands.executeCommand('python.sortImports');
        }).then(() => {
            assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
        }).then(done, done);
    });

    test('With Config', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileToFormatWithConfig).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const sorter = new PythonImportSortProvider();
            return sorter.sortImports(extensionDir, textDocument);
        }).then(edits => {
            const newValue = `from third_party import lib2${EOL}from third_party import lib3${EOL}from third_party import lib4${EOL}from third_party import lib5${EOL}from third_party import lib6${EOL}from third_party import lib7${EOL}from third_party import lib8${EOL}from third_party import lib9${EOL}`;
            assert.equal(edits.filter(value => value.newText === newValue && value.range.isEqual(new vscode.Range(0, 0, 3, 0))).length, 1, 'New Text not found');
        }).then(done, done);
    });

    test('With Config (via Command)', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        let originalContent = '';
        vscode.workspace.openTextDocument(fileToFormatWithConfig).then(document => {
            textDocument = document;
            originalContent = document.getText();
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            return vscode.commands.executeCommand('python.sortImports');
        }).then(() => {
            assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
        }).then(done, done);
    });

    // Doesn't always work on Travis !?!
    if (!IS_TRAVIS) {
        test('With Changes and Config in Args', done => {
            let textEditor: vscode.TextEditor;
            let textDocument: vscode.TextDocument;
            pythonSettings.sortImports.args = ['-sp', path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig')];
            vscode.workspace.openTextDocument(fileToFormatWithConfig).then(document => {
                textDocument = document;
                return vscode.window.showTextDocument(textDocument);
            }).then(editor => {
                assert(vscode.window.activeTextEditor, 'No active editor');
                textEditor = editor;
                return editor.edit(editor => {
                    editor.insert(new vscode.Position(0, 0), 'from third_party import lib0' + EOL);
                });
            }).then(() => {
                const sorter = new PythonImportSortProvider();
                return sorter.sortImports(extensionDir, textDocument);
            }).then(edits => {
                const newValue = `from third_party import lib1${EOL}from third_party import lib2${EOL}from third_party import lib3${EOL}from third_party import lib4${EOL}from third_party import lib5${EOL}from third_party import lib6${EOL}from third_party import lib7${EOL}from third_party import lib8${EOL}from third_party import lib9${EOL}`;
                assert.equal(edits.length, 1, 'Incorrect number of edits');
                assert.equal(edits[0].newText, newValue, 'New Value is not the same');
                assert.equal(`${edits[0].range.start.line},${edits[0].range.start.character}`, '1,0', 'Start position is not the same');
                assert.equal(`${edits[0].range.end.line},${edits[0].range.end.character}`, '2,0', 'End position is not the same');
            }).then(done, done);
        });
    }
    test('With Changes and Config in Args (via Command)', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        let originalContent = '';
        pythonSettings.sortImports.args = ['-sp', path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'sorting', 'withconfig')];
        vscode.workspace.openTextDocument(fileToFormatWithConfig).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            return editor.edit(editor => {
                editor.insert(new vscode.Position(0, 0), 'from third_party import lib0' + EOL);
            });
        }).then(() => {
            originalContent = textDocument.getText();
            return vscode.commands.executeCommand('python.sortImports');
        }).then(edits => {
            assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
        }).then(done, done);
    });
});