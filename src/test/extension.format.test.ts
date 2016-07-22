
// // Note: This example test is leveraging the Mocha test framework.
// // Please refer to their documentation on https://mochajs.org/ for help.


// // The module 'assert' provides assertion methods from node
// import * as assert from 'assert';

// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
// import * as vscode from 'vscode';
// import {AutoPep8Formatter} from '../client/formatters/autoPep8Formatter';
// import {YapfFormatter} from '../client/formatters/yapfFormatter';
// import * as path from 'path';
// import * as settings from '../client/common/configSettings';
// import * as fs from 'fs-extra';
// import {initialize} from './initialize';
// import {execPythonFile} from '../client/common/utils';

// let pythonSettings = settings.PythonSettings.getInstance();
// let ch = vscode.window.createOutputChannel('Tests');
// let pythoFilesPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'formatting');
// const originalUnformattedFile = path.join(pythoFilesPath, 'fileToFormat.py');

// const autoPep8FileToFormat = path.join(__dirname, 'pythonFiles', 'formatting', 'autoPep8FileToFormat.py');
// const autoPep8FileToAutoFormat = path.join(__dirname, 'pythonFiles', 'formatting', 'autoPep8FileToAutoFormat.py');
// const yapfFileToFormat = path.join(__dirname, 'pythonFiles', 'formatting', 'yapfFileToFormat.py');
// const yapfFileToAutoFormat = path.join(__dirname, 'pythonFiles', 'formatting', 'yapfFileToAutoFormat.py');

// let formattedYapf = '';
// let formattedAutoPep8 = '';

// suiteSetup(done => {
//     initialize().then(() => {
//         [autoPep8FileToFormat, autoPep8FileToAutoFormat, yapfFileToFormat, yapfFileToAutoFormat].forEach(file => {
//             if (fs.existsSync(file)) { fs.unlinkSync(file); }
//             fs.copySync(originalUnformattedFile, file);
//         });

//         fs.ensureDirSync(path.dirname(autoPep8FileToFormat));
//         let yapf = execPythonFile('yapf', [originalUnformattedFile], pythoFilesPath, false);
//         let autoPep8 = execPythonFile('autopep8', [originalUnformattedFile], pythoFilesPath, false);
//         return Promise.all<string>([yapf, autoPep8]).then(formattedResults => {
//             formattedYapf = formattedResults[0];
//             formattedAutoPep8 = formattedResults[1];
//         }).then(() => {
//             done();
//         });
//     }, done);
// });

// suiteTeardown(() => {
//     if (vscode.window.activeTextEditor) {
//         return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
//     }
// });

// suite('Formatting', () => {
//     teardown(() => {
//         if (vscode.window.activeTextEditor) {
//             return vscode.commands.executeCommand('workbench.action.closeActiveEditor');
//         }
//     });
//     function testFormatting(formatter: AutoPep8Formatter | YapfFormatter, formattedContents: string, fileToFormat: string): PromiseLike<void> {
//         let textEditor: vscode.TextEditor;
//         let textDocument: vscode.TextDocument;
//         return vscode.workspace.openTextDocument(fileToFormat).then(document => {
//             textDocument = document;
//             return vscode.window.showTextDocument(textDocument);
//         }).then(editor => {
//             textEditor = editor;
//             return formatter.formatDocument(textDocument, null, null);
//         }).then(edits => {
//             return textEditor.edit(editBuilder => {
//                 edits.forEach(edit => editBuilder.replace(edit.range, edit.newText));
//             });
//         }).then(edited => {
//             assert.equal(textEditor.document.getText(), formattedContents, 'Formatted text is not the same');
//         });
//     }
//     test('AutoPep8', done => {
//         testFormatting(new AutoPep8Formatter(ch, pythonSettings, pythoFilesPath), formattedAutoPep8, autoPep8FileToFormat).then(done, done);
//     });

//     test('Yapf', done => {
//         testFormatting(new YapfFormatter(ch, pythonSettings, pythoFilesPath), formattedYapf, yapfFileToFormat).then(done, done);
//     });

//     function testAutoFormatting(formatter: string, formattedContents: string, fileToFormat: string): PromiseLike<void> {
//         let textDocument: vscode.TextDocument;
//         pythonSettings.formatting.formatOnSave = true;
//         pythonSettings.formatting.provider = formatter;
//         return vscode.workspace.openTextDocument(fileToFormat).then(document => {
//             textDocument = document;
//             return vscode.window.showTextDocument(textDocument);
//         }).then(editor => {
//             return editor.edit(editBuilder => {
//                 editBuilder.insert(new vscode.Position(0, 0), '#\n');
//             });
//         }).then(edited => {
//             return textDocument.save();
//         }).then(saved => {
//             return new Promise<any>((resolve, reject) => {
//                 setTimeout(() => {
//                     resolve();
//                 }, 2000);
//             });
//         }).then(() => {
//             assert.equal(textDocument.getText(), formattedContents, 'Formatted contents are not the same');
//         });
//     }
//     test('AutoPep8 autoformat on save', done => {
//         testAutoFormatting('autopep8', '#\n' + formattedAutoPep8, autoPep8FileToAutoFormat).then(done, done);
//     });

//     test('Yapf autoformat on save', done => {
//         testAutoFormatting('yapf', '#\n' + formattedYapf, yapfFileToAutoFormat).then(done, done);
//     });
// });