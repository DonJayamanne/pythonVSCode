// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.


// Place this right on top
import { initialize, PYTHON_PATH, closeActiveWindows } from '../initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { EOL } from 'os';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from '../../client/common/configSettings';

let pythonSettings = settings.PythonSettings.getInstance();
let autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'definition');
const fileOne = path.join(autoCompPath, 'one.py');
const fileTwo = path.join(autoCompPath, 'two.py');
const fileThree = path.join(autoCompPath, 'three.py');
const fileDecorator = path.join(autoCompPath, 'decorators.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');

suite('Code Definition', () => {
    suiteSetup(done => {
        initialize().then(() => {
            pythonSettings.pythonPath = PYTHON_PATH;
            done();
        }, done);
    });

    suiteTeardown(done => {
        closeActiveWindows().then(done, done);
    });
    teardown(done => {
        closeActiveWindows().then(done, done);
    });

    test('Go to method', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(30, 5);
            return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '17,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '21,11', 'End position is incorrect');
        }).then(done, done);
    });

    test('Go to function', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileOne).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(45, 5);
            return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '32,0', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '33,21', 'End position is incorrect');
        }).then(done, done);
    });

    test('Go to function with decorator', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDecorator);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(7, 2);
        const def = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '4,0', 'Start position is incorrect');
        assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '5,22', 'End position is incorrect');
    });

    test('Go to function decorator', async () => {
        const textDocument = await vscode.workspace.openTextDocument(fileDecorator);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(3, 3);
        const def = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '0,0', 'Start position is incorrect');
        assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '1,12', 'End position is incorrect');
    });

    test('Across files', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileThree).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 5);
            return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '0,0', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '5,11', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileTwo, 'File is incorrect');
        }).then(done, done);
    });

    test('With Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncoding).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(25, 6);
            return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '10,4', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '16,35', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileEncoding, 'File is incorrect');
        }).then(done, done);
    });

    test('Across files with Unicode Characters', done => {
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileEncodingUsed).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            assert(vscode.window.activeTextEditor, 'No active editor');
            textEditor = editor;
            const position = new vscode.Position(1, 11);
            return vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', textDocument.uri, position);
        }).then(def => {
            assert.equal(def.length, 1, 'Definition length is incorrect');
            assert.equal(`${def[0].range.start.line},${def[0].range.start.character}`, '18,0', 'Start position is incorrect');
            assert.equal(`${def[0].range.end.line},${def[0].range.end.character}`, '23,16', 'End position is incorrect');
            assert.equal(def[0].uri.fsPath, fileEncoding, 'File is incorrect');
        }).then(done, done);
    });
});
