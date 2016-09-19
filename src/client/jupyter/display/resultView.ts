'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private htmlResponse: string = '';
    private results: any[];
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return Promise.resolve(this.generateResultsView());
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public setText(result: string, results: any[]) {
        this.htmlResponse = result;
        this.results = results;
    }
    public update() {
        this._onDidChange.fire(this.lastUri);
    }

    private getStyleSheetPath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', '..', 'resources', resourceName)).toString();
    }
    private getScriptFilePath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', '..', 'out', 'client', 'jupyter', 'browser', resourceName)).toString();
    }
    private getNodeModulesPath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', '..', 'node_modules', resourceName)).toString();
    }

    private generateErrorView(error: string): string {
        return `<head></head><body>${error}</body>`;
    }

    private generateResultsView(): string {
        const html = `
                <head>
                </head>
                <body onload="initializeResults()">
                    <script type="text/javascript">
                        window.JUPYTER_DATA = ${JSON.stringify(this.results)};
                    </script>
                    <script src="${this.getScriptFilePath('bundle.js')}"></script>
                </body>
            `;
        fs.writeFileSync('/Users/donjayamanne/.vscode/extensions/pythonVSCode/results.html', html);
        return html;
    }
}
