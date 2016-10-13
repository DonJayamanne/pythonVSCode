
// // Note: This example test is leveraging the Mocha test framework.
// // Please refer to their documentation on https://mochajs.org/ for help.


// // The module 'assert' provides assertion methods from node
// import * as assert from 'assert';

// // You can import and use all API from the 'vscode' module
// // as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as path from 'path';
// import * as settings from '../client/common/configSettings';
// import * as fs from 'fs-extra';
// import { initialize } from './initialize';
// import { execPythonFile } from '../client/common/utils';

// import { iPythonAdapter } from '../client/jupyter/comms/ipythonAdapter';
// import { SocketServer } from '../client/common/comms/socketServer';
// import * as child_process from 'child_process';
// import { createDeferred } from '../client/common/helpers';

// let pythonSettings = settings.PythonSettings.getInstance();
// let ch = vscode.window.createOutputChannel('Tests');
// let outputChannel = ch;
// let pythoFilesPath = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'formatting');

// let childProc: child_process.ChildProcess;
// let socketServer: SocketServer;
// let ipythonAdapter: iPythonAdapter;

// suiteSetup(done => {
//     initialize().then(() => {
//         const pyFile = path.join(__dirname, '..', '..', '..', '..', 'pythonFiles', 'PythonTools', 'ipythonServer.py');
//         socketServer = new SocketServer();
//         ipythonAdapter = new iPythonAdapter(this.socketServer);
//         socketServer.Start().then(port => {
//             const def = createDeferred<any>();
//             // We want to test this
//             const newEnv = { "TEST_DJAYAMANNE_IPYTHON": "1" };
//             Object.assign(newEnv, process.env);

//             // Any version of python will do, even without jupyter or ipython
//             childProc = child_process.spawn('python', [pyFile, port.toString()], { env: newEnv });
//             childProc.stdout.setEncoding('utf8');
//             childProc.stderr.setEncoding('utf8');

//             childProc.stdout.on('data', (data: string) => {
//                 outputChannel.append(data);
//             });
//             childProc.stderr.on('data', (data: string) => {
//                 outputChannel.append(data);
//             });
//             done();

//             // setTimeout(() => {
//             //     //this.socketServer.
//             //     this.ipythonAdapter.ping();
//             //     this.ipythonAdapter.listKernels().then(x => {
//             //         const y = x;
//             //     }, reason => {
//             //         const y = reason;
//             //     })
//             // }, 1000);
//         });
//     }, done);
// });

// suiteTeardown(() => {
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
// });