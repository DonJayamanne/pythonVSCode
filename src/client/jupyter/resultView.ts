'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private htmlResponse: string = '';
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return Promise.resolve(this.generateResultsView());
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public setText(result: string) {
        this.htmlResponse = result;
    }
    public update() {
        this._onDidChange.fire(this.lastUri);
    }

    private getStyleSheetPath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', resourceName)).toString();
    }
    private getScriptFilePath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'out', 'client', 'jupyter', resourceName)).toString();
    }
    private getNodeModulesPath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'node_modules', resourceName)).toString();
    }

    private generateErrorView(error: string): string {
        return `<head></head><body>${error}</body>`;
    }

    private generateResultsView(): string {
        const innerHtml = this.htmlResponse;
        const customScripts = '';
        const html = `
                <head>
                </head>
                <body>
                    ${innerHtml}
                <div style="display:none">
                    <script type="text/javascript">
                    function testClick(){
                        document.getElementById('xx').innerHTML = 'one';
                    }
                    </script>
                    <button onclick="testClick(); return false;">Test</button>
                    <div id="xx">wow</div>
                    <div class="script">${this.getNodeModulesPath(path.join('jquery', 'dist', 'jquery.min.js'))}</div>
                    ${customScripts}
                </div>
                </body>
            `;
        // fs.writeFileSync('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/results.html', html);
        return html;
    }
}
