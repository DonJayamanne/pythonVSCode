'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    public static htmlResponse: string = '';
    public static scripts: string[] = [];
    public static images: string[] = [];
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        return Promise.resolve(this.generateResultsView());
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
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
        const innerHtml = TextDocumentContentProvider.htmlResponse;
        // return `<head></head><body>${TextDocumentContentProvider.htmlResponse}</body>`;
        const customScripts = TextDocumentContentProvider.scripts.reduce((previousValue, currentValue) => {
            return previousValue + `<div class="evalScript">${currentValue}</div>`;
        }, '');
        const images = TextDocumentContentProvider.images.reduce((previousValue, currentValue) => {
            return previousValue + `<img src="data:image/png;base64,${currentValue}" />`;
        }, '');
        const html = `
                <head>
                </head>
                <body id= "myBody" onload="var script = document.createElement('script');script.setAttribute('src', '${this.getScriptFilePath('proxy.js')}');script.setAttribute('type', 'text/javascript');document.getElementById('myBody').appendChild(script);">
                    ${innerHtml}
                    ${images}
                <div style="display:none">
                    <div class="script">${this.getNodeModulesPath(path.join('jquery', 'dist', 'jquery.min.js'))}</div>
                    ${customScripts}
                </div>
                </body>
            `;
        fs.writeFileSync('/Users/donjayamanne/.vscode-insiders/extensions/pythonVSCode/results.html', html);
        return html;
    }
}
