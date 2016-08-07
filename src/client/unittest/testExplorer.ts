'use strict';

import * as vscode from 'vscode';
import {TestManager} from './testManager';
import {TestFile, TestStatus} from './contracts';
import * as htmlGenerator from './htmlGenerator';
import * as fs from 'fs';

const testSchema = 'python-test-explorer';

let previewUri = vscode.Uri.parse(testSchema + '://authority/css-preview');
let testManager: TestManager;
let filesRetreived: boolean;

class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private tests: TestFile[];
    private lastError: any;
    private lastUri: vscode.Uri;
    private getFilesInvoked: boolean;

    public provideTextDocumentContent(uri: vscode.Uri): string {
        if (!filesRetreived) {
            testManager.getTestFiles().then(tests => {
                filesRetreived = true;
                this.tests = tests;
                this.lastError = null;
                this.update(uri);
            }).catch(error => {
                filesRetreived = true;
                this.lastError = error;
                this.update(uri);
            });
        }

        return this.createTestExplorerView();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }

    private createTestExplorerView(): string {
        if (this.lastError) {
            this.lastError = null;
            return htmlGenerator.generateErrorView('Unknown Error', this.lastError);
        } else {
            let vw = this.generateTestExplorer();
            fs.writeFileSync('/Users/donjayamanne/Desktop/Development/Node/testRunner/test.1.html', vw);
            return vw;
        }
    }

    private errorMessage(error: string): string {
        return `
            <body>
                ${error}
            </body>`;
    }

    private generateTestExplorer(): string {
        const now = new Date().toString();
        let innerHtml = '';
        let menuHtml = htmlGenerator.generateHtmlForMenu(testManager.status);

        switch (testManager.status) {
            case TestStatus.Unknown:
            case TestStatus.Discovering: {
                innerHtml = htmlGenerator.generateDiscoveringHtmlView();
                break;
            }
            case TestStatus.Idle:
            case TestStatus.Running: {
                innerHtml = htmlGenerator.generateTestExplorerHtmlView(this.tests, testManager.status);
                break;
            }
        }

        return `
                ${htmlGenerator.TREE_STYLES}
                <style>
                    body {
                        black;
                    }
                </style>
                <body>
                    <div>
                        ${menuHtml}
                    </div><hr/>
                    <div>
                        <ol class="ts-tree " id="">
                            ${innerHtml}
                        </ol>
                    </div>
                </body>
                `;
    }
}

export function activate(context: vscode.ExtensionContext, ouputChannel: vscode.OutputChannel) {
    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider(testSchema, provider);

    let disposable = vscode.commands.registerCommand('python.viewTestExplorer', () => {
        previewUri = vscode.Uri.parse(testSchema + '://authority/css-preview' + new Date().getTime().toString());
        filesRetreived = false;
        testManager = new TestManager(vscode.workspace.rootPath, vscode.workspace.rootPath);
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Python Test Explorer').then((success) => {
        }, (reason) => {
            vscode.window.showErrorMessage(reason);
        });
    });
    context.subscriptions.push(disposable, registration);

    disposable = vscode.commands.registerCommand('python.runAllUnitTests', (runTests: boolean) => {
        testManager.getTestFiles().then(tests => {
            testManager.runTest().then(() => {
                provider.update(previewUri);
            }).catch(err => {
                vscode.window.showErrorMessage('There was an error in running the tests, view the output Channel');
                ouputChannel.appendLine(err);
                ouputChannel.show();
            });
        });
    });

    disposable = vscode.commands.registerCommand('python.runUnitTest', (type: string, rawPath: string) => {
        testManager.getTestFiles().then(tests => {
            testManager.runTest().then(() => {
                provider.update(previewUri);
            }).catch(err => {
                vscode.window.showErrorMessage('There was an error in running the tests, view the output Channel');
                ouputChannel.appendLine(err);
                ouputChannel.show();
            });
        });
    });

    disposable = vscode.commands.registerCommand('python.discoverUnitTests', (runTests: boolean) => {
        filesRetreived = false;
        provider.update(previewUri);
    });

    context.subscriptions.push(disposable);
}