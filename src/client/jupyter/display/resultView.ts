'use strict';

import * as vscode from 'vscode';
import {Disposable} from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as helpers from '../../common/helpers';

export class TextDocumentContentProvider extends Disposable implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private lastUri: vscode.Uri;
    private htmlResponse: string = '';
    private results: any[];
    private serverPort: number;
    private tmpFileCleanup: Function[] = [];
    private appendResults: boolean;
    constructor() {
        super(() => { });
    }
    public dispose() {
        this.tmpFileCleanup.forEach(fn => {
            try {
                fn();
            }
            catch (ex) { }
        });
    }
    public set ServerPort(value: number) {
        this.serverPort = value;
    }
    public set AppendResults(value: boolean) {
        this.appendResults = value;
    }
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

    private getScriptFilePath(resourceName: string): string {
        return vscode.Uri.file(path.join(__dirname, '..', '..', '..', '..', 'out', 'client', 'jupyter', 'browser', resourceName)).toString();
    }

    private tmpHtmlFile: string;
    private buildHtmlContent(): Promise<string> {
        // Don't put this, stuffs up SVG hrefs
        // <basex href="${path.join(__dirname, '..', '..', '..', '..')}" target="_blank">
        const dirNameForScripts = path.join(__dirname, '..', '..', '..');
        const html = `
                <!DOCTYPE html>
                <html> 
                <head>
                    <script src="http://localhost:${this.serverPort}/socket.io/socket.io.js"></script>
                    <script type="text/javascript">
                        window.JUPYTER_DATA = ${JSON.stringify(this.results)};
                    </script>
                    <script src="${this.getScriptFilePath('bundle.js')}?x=${new Date().getMilliseconds()}"></script>
                    <style type="text/css">
                        /*Enable for sticky header (though scrollbars are white :()*/
                        /*
                        html, body {
                            margin:0;
                            height:100vh;
                            min-height:100vh;
                        }
                        body {
                            margin:0;
                            display: flex;
                            flex-direction: column;
                            overflow-y:hidden;
                        }
                        #displayStyle {
                            flex: 1 0;   
                            margin-bottom:0.25em;                         
                        }
                        #resultsContainer {
                            flex: auto;
                            overflow-y: auto;
                        }    
                        /*                    
                    </style>
                </head>
                <body onload="initializeResults('${dirNameForScripts}', ${this.serverPort})">
                    <div id="resultMenu">
                        <label><input id="displayStyle" type="checkbox" ${this.appendResults ? 'checked' : ''}>Append Results</label>
                        &nbsp;
                        <button id="clearResults">Clear Results</button>
                        <br>
                    </div>
                    <div id="resultsContainer">
                    </div>
                </body>
                </html>
            `;
        return Promise.resolve(html);
    }
    private getTemporaryHtmlFileName(): Promise<string> {
        let htmlFile: helpers.Deferred<string> = helpers.createDeferred<string>();
        if (this.tmpHtmlFile) {
            fs.exists(this.tmpHtmlFile, exists => {
                if (exists) {
                    return htmlFile.resolve(this.tmpHtmlFile);
                }
                helpers.createTemporaryFile('.html').then(tmpFile => {
                    this.tmpFileCleanup.push(tmpFile.cleanupCallback);
                    htmlFile.resolve(tmpFile.filePath);
                });
            });
        }
        else {
            helpers.createTemporaryFile('.html').then(tmpFile => {
                this.tmpHtmlFile = tmpFile.filePath;
                this.tmpFileCleanup.push(tmpFile.cleanupCallback);
                htmlFile.resolve(tmpFile.filePath);
            });
        }
        return htmlFile.promise;
    }
    private generateResultsView(): Promise<string> {
        return Promise.all<string>([this.buildHtmlContent(), this.getTemporaryHtmlFileName()])
            .then(data => {
                const html = data[0];
                const htmlFileName = data[1];
                const htmlContent = `
                    <!DOCTYPE html>
                    <head><style type="text/css"> html, body{ height:100%; width:100%; } </style>
                    <script type="text/javascript">
                        function start(){
                            var color = '';
                            var fontFamily = '';
                            var fontSize = '';
                            try {
                                computedStyle = window.getComputedStyle(document.body);
                                color = computedStyle.color + '';
                                fontFamily = computedStyle.fontFamily;
                                fontSize = computedStyle.fontSize;
                            }
                            catch(ex){
                            }
                            document.getElementById('myframe').src = '${vscode.Uri.file(htmlFileName).toString()}?color=' + encodeURIComponent(color) + "&fontFamily=" + encodeURIComponent(fontFamily) + "&fontSize=" + encodeURIComponent(fontSize);
                        }
                    </script>
                    </head>
                    <body onload="start()">
                    <iframe id="myframe" frameborder="0" style="border: 0px solid transparent;height:100%;width:100%;"
                    src="" seamless></iframe></body></html>`;

                let def = helpers.createDeferred<string>();
                fs.writeFile(htmlFileName, html, err => {
                    if (err) {
                        return def.reject(err);
                    }
                    def.resolve(htmlContent);
                });

                return def.promise;
            });
    }
}
