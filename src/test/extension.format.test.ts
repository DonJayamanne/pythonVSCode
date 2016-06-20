//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import {AutoPep8Formatter} from "../client/formatters/autoPep8Formatter";
import {YapfFormatter} from "../client/formatters/yapfFormatter";
import * as path from "path";
import * as settings from "../client/common/configSettings";
import * as fs from "fs-extra";

let pythonSettings = settings.PythonSettings.getInstance();
let ch = vscode.window.createOutputChannel("Tests");
let pythoFilesPath = path.join(__dirname, "..", "..", "src", "test", "pythonFiles", "formatting");

suite("Formatting", () => {
    setup(() => {
        return new Promise<any>(resolve => {
            setTimeout(function () {
                resolve();
            }, 1000);
        });
    });
    teardown(() => {
        if (vscode.window.activeTextEditor) {
            return vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }
        return Promise.resolve();
    });
    test("AutoPep8", done => {
        let fileToFormat = path.join(pythoFilesPath, "beforeAutoPep8.py");
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileToFormat).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            textEditor = editor;
            let formatter = new AutoPep8Formatter(ch, pythonSettings, pythoFilesPath);
            return formatter.formatDocument(textDocument, null, null);
        }).then(edits => {
            return textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });
        }).then(edited => {
            let formattedFile = path.join(pythoFilesPath, "afterAutoPep8.py");
            let formattedContents = fs.readFile(formattedFile, "utf-8", (error, data) => {
                if (error) {
                    return assert.fail(error, "", "Failed to read formatted file");
                }
                assert.equal(textEditor.document.getText(), data, "Formatted text is not the same");
            });
        }).then(done, done);
    });

    test("Yapf", done => {
        let fileToFormat = path.join(pythoFilesPath, "beforeYapf.py");
        let textEditor: vscode.TextEditor;
        let textDocument: vscode.TextDocument;
        vscode.workspace.openTextDocument(fileToFormat).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            textEditor = editor;
            let formatter = new YapfFormatter(ch, pythonSettings, pythoFilesPath);
            return formatter.formatDocument(textDocument, null, null);
        }).then(edits => {
            return textEditor.edit(editBuilder => {
                edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
            });
        }).then(edited => {
            let formattedFile = path.join(pythoFilesPath, "afterYapf.py");
            let formattedContents = fs.readFile(formattedFile, "utf-8", (error, data) => {
                if (error) {
                    return assert.fail(error, "", "Failed to read formatted file");
                }
                var x = textEditor.document.getText();
                assert.equal(textEditor.document.getText(), data, "Formatted text is not the same");
            });
        }).then(done, done);
    });

    test("Yapf autoformat on save", done => {
        let formattedFile = path.join(pythoFilesPath, "afterYapfFormatOnSave.py");
        let fileToCopyFrom = path.join(pythoFilesPath, "beforeYapfFormatOnSaveOriginal.py");
        let formattedFileContents = fs.readFileSync(formattedFile, "utf-8");

        let fileToFormat = path.join(pythoFilesPath, "beforeYapf.py");
        let textDocument: vscode.TextDocument;

        if (fs.existsSync(fileToFormat)) { fs.unlinkSync(fileToFormat); }
        fs.copySync(fileToCopyFrom, fileToFormat);
        const FORMAT_ON_SAVE = pythonSettings.formatting.formatOnSave;
        pythonSettings.formatting.formatOnSave = true;
        pythonSettings.formatting.provider = "yapf";

        vscode.workspace.openTextDocument(fileToFormat).then(document => {
            textDocument = document;
            return vscode.window.showTextDocument(textDocument);
        }).then(editor => {
            return editor.edit(editBuilder => {
                editBuilder.insert(new vscode.Position(0, 0), "#\n");
            });
        }).then(saved => {
            return new Promise<any>((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });
        }).then(() => {
            assert.equal(textDocument.getText(), formattedFileContents, "Formatted contents are not the same");
        }).then(done, done);
    });
});