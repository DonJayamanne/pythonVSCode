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
        // const resourcesPath = path.join(__dirname, '..', '..', '..', 'resources');
        // return `
        //     <head>
        //         <link rel="stylesheet" href="${this.getStyleSheetPath('reset.css')}" >
        //         <link rel="stylesheet" href="${this.getStyleSheetPath(path.join('octicons', 'font', 'octicons.css'))}" >
        //         <link rel="stylesheet" href="${this.getStyleSheetPath(path.join('font-awesome-4.6.3', 'css', 'font-awesome.min.css'))}" >
        //         <link rel="stylesheet" href="${this.getStyleSheetPath('main.css')}" >
        //     </head>
        //     <body>
        //         <style>
        //         </style>
        //         <div class="errorContents">
        //             <div><i class="fa fa-exclamation-triangle" aria-hidden="true"></i>Error</div>
        //             <div>${error}</div>
        //         </div>
        //     </body>
        //     `;
    }

    private generateResultsView(): string {
        const innerHtml = this.htmlResponse;
        const customScripts = '';
        // const customScripts = TextDocumentContentProvider.scripts.reduce((previousValue, currentValue) => {
        //     return previousValue + `<div class="evalScript">${currentValue}</div>`;
        // }, '');
        const html = `
                <head>
                </head>
                <body id= "myBody" onload="var script = document.createElement('script');script.setAttribute('src', '${this.getScriptFilePath('proxy.js')}');script.setAttribute('type', 'text/javascript');document.getElementById('myBody').appendChild(script);">
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
        fs.writeFileSync('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/results.html', html);
        return html;
    }
}
