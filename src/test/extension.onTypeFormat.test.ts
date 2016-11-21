
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, IS_TRAVIS, PYTHON_PATH, closeActiveWindows } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../client/common/configSettings';
import * as fs from 'fs-extra';
import { BlockFormatProviders } from '../client/typeFormatters/blockFormatProvider';
let pythonSettings = settings.PythonSettings.getInstance();
let srcPythoFilesPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'typeFormatFiles');
let outPythoFilesPath = path.join(__dirname, '..', 'pythonFiles', 'typeFormatFiles');

const tryBlock2OutFilePath = path.join(outPythoFilesPath, 'tryBlocks2.py');

suite('Formatting', () => {
    let provider: BlockFormatProviders;
    const formatOptions2: vscode.FormattingOptions = {
        insertSpaces: true, tabSize: 2
    };

    suiteSetup(done => {
        initialize().then(() => {
            provider = new BlockFormatProviders();
            pythonSettings.pythonPath = PYTHON_PATH;
            fs.ensureDirSync(path.dirname(outPythoFilesPath));

            ['tryBlocks2.py', 'tryBlocks4.py', 'tryBlocksTab.py'].forEach(file => {
                const targetFile = path.join(outPythoFilesPath, file);
                if (fs.existsSync(targetFile)) { fs.unlinkSync(targetFile); }
                fs.copySync(path.join(srcPythoFilesPath, file), targetFile);
            });
        }).then(done).catch(done);
    });
    suiteTeardown(done => {
        closeActiveWindows().then(done, done);
    });
    teardown(done => {
        closeActiveWindows().then(done, done);
    });

    function testFormatting(fileToFormat: string, position: vscode.Position, expectedEdits: vscode.TextEdit[]): PromiseLike<void> {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        return vscode.workspace.openTextDocument(fileToFormat).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            return provider.provideOnTypeFormattingEdits(textDocument, position, ':', formatOptions2, null);
        }).then(edits => {
            assert.equal(edits.length, expectedEdits.length, 'Number of edits not the same');
            edits.forEach((edit, index) => {
                const expectedEdit = expectedEdits[index];
                assert.equal(edit.newText, expectedEdit.newText, `newText for edit is not the same for index = ${index}`);
                assert.ok(edit.range.isEqual(expectedEdit.range), `range for edit is not the same for index = ${index}, provided ${edit.range + ''}, expected ${expectedEdit.range + ''}`);
            });
        }, reason => {
            assert.fail(reason, undefined, 'Type Formatting failed', '');
        });
    }
    test('1. except off by tab', done => {
        const lineNumber = 6;
        const pos = new vscode.Position(lineNumber, 22);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('2. except off by one should not be formatted', done => {
        const lineNumber = 15;
        const pos = new vscode.Position(lineNumber, 21);
        const expectedEdits = [];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('3. except off by tab inside a for loop', done => {
        const lineNumber = 35;
        const pos = new vscode.Position(lineNumber, 13);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('4. except off by one inside a for loop should not be formatted', done => {
        const lineNumber = 47;
        const pos = new vscode.Position(lineNumber, 12);
        const expectedEdits = [
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('5. except IOError: off by tab inside a for loop', done => {
        const lineNumber = 54;
        const pos = new vscode.Position(lineNumber, 19);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('6. else: off by tab inside a for loop', done => {
        const lineNumber = 76;
        const pos = new vscode.Position(lineNumber, 9);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('7. except ValueError:: off by tab inside a function', done => {
        const lineNumber = 143;
        const pos = new vscode.Position(lineNumber, 22);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('8. except ValueError as err: off by one inside a function should not be formatted', done => {
        const lineNumber = 157;
        const pos = new vscode.Position(lineNumber, 25);
        const expectedEdits = [
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('9. else: off by tab inside function', done => {
        const lineNumber = 172;
        const pos = new vscode.Position(lineNumber, 11);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
    test('10. finally: off by tab inside function', done => {
        const lineNumber = 195;
        const pos = new vscode.Position(lineNumber, 12);
        const expectedEdits = [
            vscode.TextEdit.delete(new vscode.Range(lineNumber, 0, lineNumber, 2))
        ];
        testFormatting(tryBlock2OutFilePath, pos, expectedEdits).then(done, done);
    });
});