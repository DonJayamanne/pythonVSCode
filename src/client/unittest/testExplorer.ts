'use strict';

import * as vscode from 'vscode';
import {TestManager} from './testManager';
import {TestFile} from './contracts';

const testSchema = 'python-test-explorer';
let previewUri = vscode.Uri.parse(testSchema + '://authority/css-preview');

let testManager: TestManager;
let filesRetreived:boolean;
class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private tests: TestFile[];
    private pendingTaskCounter: number = 0;
    private lastError: any;
    private lastUri: vscode.Uri;
    private getFilesInvoked: boolean;
    public provideTextDocumentContent(uri: vscode.Uri): string {
        if (!filesRetreived) {
            this.pendingTaskCounter += 1;
            testManager.getTestFiles().then(tests => {
                filesRetreived = true;
                this.pendingTaskCounter -= 1;
                this.tests = tests;
                this.lastError = null;
                // uri = vscode.Uri.parse(testSchema + '://authority/css-preview2' + new Date().getTime().toString());
                this.update(uri);
            }).catch(error => {
                filesRetreived = true;
                this.lastError = error;
                // uri = vscode.Uri.parse(testSchema + '://authority/css-preview2' + new Date().getTime().toString());
                this.update(uri);
            });
        }

        return this.createTestView();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }

    private createErrorView(error: any): string {
        return '<body>Something went wrong</body>';
    }
    private createTestView(): string {
        if (this.lastError) {
            this.lastError = null;
            return this.errorMessage("Cannot determine the rule's properties." + this.lastError);
        } else {
            return this.generateTestExplorer();
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
        return `<style>
            </style>
            <body>
                <div>Preview of the <a href="${encodeURI('command:python.runAllPyTests?' + JSON.stringify([true]))}">CSS properties</a></dev>
                <hr>
                <div>${now}</div>
                <div id="el">Lorem ipsum dolor sit amet, mi et mauris nec ac luctus lorem, proin leo nulla integer metus vestibulum lobortis, eget</div>
            </body>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider(testSchema, provider);

    let disposable = vscode.commands.registerCommand('python.viewTestExplorer', () => {
        previewUri = vscode.Uri.parse(testSchema + '://authority/css-preview' + new Date().getTime().toString());
        filesRetreived = false;
        testManager = new TestManager(vscode.workspace.rootPath, "tests");
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Python Test Explorer').then((success) => {
        }, (reason) => {
            vscode.window.showErrorMessage(reason);
        });
    });
    context.subscriptions.push(disposable, registration);

    disposable = vscode.commands.registerCommand('python.runAllPyTests', (runTests: boolean) => {
        testManager.getTestFiles().then(tests => {
            testManager.runTest().then(() => {
                provider.update(previewUri);
            }).catch(err => {
                vscode.window.showErrorMessage(err);
            });
        });
    });

    context.subscriptions.push(disposable);
}