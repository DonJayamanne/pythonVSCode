'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as helpers from '../../common/helpers';

export class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private htmlResponse: string = '';
    private results: any[];
    public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
        this.lastUri = uri;
        return this.generateResultsView();
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

    private tmpHtmlFile: string;
    private generateResultsView(): Promise<string> {
        // Use this hack only when using the iframe option
        const style = `
                <style type="text/css">
                html, body{
                    height:100%;
                    width:100%;
                }
                </style>`;
        const html = `
                <head>
                </head>
                <body onload="initializeResults()">
                    <script type="text/javascript">
                        window.JUPYTER_DATA = ${JSON.stringify(this.results)};
                    </script>
                    <script src="${this.getScriptFilePath('bundle.js')}?x=${new Date().getMilliseconds()}"></script>
                </body>
            `;
        // fs.writeFileSync('/Users/donjayamanne/.vscode/extensions/pythonVSCode/results.html', html);
        return Promise.resolve(html);

        // let htmlFile: helpers.Deferred<string> = helpers.createDeferred<string>();
        // if (this.tmpHtmlFile) {
        //     fs.exists(this.tmpHtmlFile, exists => {
        //         if (exists) {
        //             return htmlFile.resolve(this.tmpHtmlFile);
        //         }
        //         helpers.createTemporaryFile('.html').then(tmpFile => {
        //             htmlFile.resolve(tmpFile.filePath);
        //         });
        //     });
        // }
        // else {
        //     helpers.createTemporaryFile('.html').then(tmpFile => {
        //         htmlFile.resolve(tmpFile.filePath);
        //     });
        // }

        // return htmlFile.promise.then(htmlFileName => {
        //     const htmlContent = `
        //     <head>
        //         <style type="text/css">
        //         html, body{
        //             height:100%;
        //             width:100%;
        //         }
        //         </style>
        //     </head>
        //     <body><iframe frameborder="0" style="border: 0px solid white;height:100%;width:100%;" src="${htmlFileName}" seamless></iframe></body>`;
        //     return new Promise<string>((resolve, reject) => {
        //         fs.writeFile(htmlFileName, html, err => {
        //             if (err) {
        //                 return reject(err);
        //             }
        //             fs.writeFileSync('/Users/donjayamanne/.vscode/extensions/pythonVSCode/results.html', htmlContent);
        //             resolve(htmlContent);
        //         });
        //     });
        // });
    }
}
