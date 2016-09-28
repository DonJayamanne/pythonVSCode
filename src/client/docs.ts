'use strict';

import * as vscode from 'vscode';
import {Disposable} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from './common/constants';

export class TextDocumentContentProvider extends Disposable implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    constructor() {
        super(() => { });
    }
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return this.generateResultsView();
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update() {
        this._onDidChange.fire(this.lastUri);
    }

    private generateResultsView(): Promise<string> {
        const htmlContent = `
                    <!DOCTYPE html>
                    <head><style type="text/css"> html, body{ height:100%; width:100%; } </style>
                    <script type="text/javascript">
                    </script>
                    </head>
                    <body>
                    <iframe id="myframe" frameborder="0" style="border: 0px solid transparent;height:100%;width:100%;"
                    src="http://0.0.0.0:8000/docs/jupyter_prerequisites/" seamless></iframe></body></html>`;
        return Promise.resolve(htmlContent);
    }
}

export class DocProvider {
    constructor() {
        const helpSchema = 'help-viewer';
        const previewUri = vscode.Uri.parse(helpSchema + '://authority/jupyter');

        const textProvider = new TextDocumentContentProvider();
        vscode.workspace.registerTextDocumentContentProvider(helpSchema, textProvider);

        vscode.commands.registerCommand('python.displayHelp', (page: string) => {
            return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.One, 'Help')
                .then(() => {
                    // Do nothing
                }, reason => {
                    // vscode.window.showErrorMessage(reason);
                });
        });
    }
}