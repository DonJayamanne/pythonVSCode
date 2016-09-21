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

    private generateErrorView(error: string): string {
        return `<head></head><body>${error}</body>`;
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
                </head>
                <body onload="initializeResults('${dirNameForScripts}', ${this.serverPort})">
                    <!--
                    <label for"displayStyle">Result display style </label>
                    <select id="displayStyle">
                        <option value="append">Append</option>
                        <option value="clear">Clear Previous Results</option>
                    </select>
                    <label for"bg">Background </label>
                    <select id="bg">
                        <option value="append">White</option>
                        <option value="clear">Themed</option>
                    </select>
                    <br>
                    -->
                    <script type="text/javascript">
                        window.JUPYTER_DATA = ${JSON.stringify(this.results)};
                    </script>
                    <script src="${this.getScriptFilePath('bundle.js')}?x=${new Date().getMilliseconds()}"></script>
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
                            console.log('starting');
                            var ele = document.getElementById('x');
                            try {
                                ele.innerHTML = 'Color is ' + ele.style.color
                            }
                            catch(ex){
                                console.log(ex.message);
                            }
                            try {
                                console.log(ele.style.color);
                            }
                            catch(ex){
                                console.log(ex.message);
                            }
                            try {
                                console.log(window.getComputedStyle(ele));
                            }
                            catch(ex){
                                console.log(ex.message);
                            }
                            try {
                                console.log(window.getComputedStyle(ele).color);
                            }
                            catch(ex){
                                console.log(ex.message);
                            }
                            try {
                                console.log(JSON.stringify(window.getComputedStyle(ele)));
                            }
                            catch(ex){
                                console.log(ex.message);
                            }

                        }
                        setTimeout(function() {
                            start();
                        }, 5000);
                    </script>
                    </head>
                    <body onload="start()">
                    <label id="x">Test</label>
                    <iframe frameborder="0" style="border: 0px solid white;height:100%;width:100%;"
                    src="${vscode.Uri.file(htmlFileName).toString()}" seamless></iframe></body></html>`;

                let def = helpers.createDeferred<string>();
                fs.writeFile(htmlFileName, html, err => {
                    if (err) {
                        return def.reject(err);
                    }
                    // fs.writeFileSync('/Users/donjayamanne/.vscode/extensions/pythonVSCode/results.html', htmlContent);
                    def.resolve(htmlContent);
                });

                return def.promise;
            });
    }
}
