'use strict';

import * as vscode from 'vscode';
import {Disposable} from 'vscode';
import * as path from 'path';
import * as http from 'http';
import {createDeferred} from './common/helpers';
const nodeStatic = require('node-static');

let serverAddress = "http://localhost:8080";
let helpPageToDisplay = "/docs/jupyter/";
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
        const addresss = serverAddress + helpPageToDisplay;
        const htmlContent = `
                    <!DOCTYPE html>
                    <head>
                    <style type="text/css"> html, body{ height:100%; width:100%; }</style>
                    </head>
                    <body>
                    <iframe frameborder="0" style="border: 0px solid transparent;height:100%;width:100%;background-color:white;" src="${addresss}"></iframe>
                    </body>
                    </html>`;
        return Promise.resolve(htmlContent);
    }
}
const helpSchema = 'help-viewer';
const previewUri = vscode.Uri.parse(helpSchema + '://authority/jupyter');

export class HelpProvider {
    private disposables: Disposable[] = [];
    constructor() {
        const textProvider = new TextDocumentContentProvider();
        this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(helpSchema, textProvider));
        this.disposables.push(vscode.commands.registerCommand('python.displayHelp', (page: string) => {
            this.startServer().then(port => {
                helpPageToDisplay = page;
                vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Help');
            });
        }));
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.stop();
    }
    private httpServer: http.Server;
    private port: number;
    private startServer(): Promise<number> {
        if (this.port) {
            return Promise.resolve(this.port);
        }

        let def = createDeferred<number>();
        var file = new nodeStatic.Server(path.join(__dirname, '..', '..', 'docs'));
        this.httpServer = http.createServer((request, response) => {
            request.addListener('end', function () {
                // 
                // Serve files! 
                // 
                file.serve(request, response);
            }).resume();
        });

        this.httpServer.listen(0, () => {
            this.port = this.httpServer.address().port;
            serverAddress = 'http://localhost:' + this.port.toString();
            def.resolve(this.port);
            def = null;
        });
        this.httpServer.on('error', error => {
            if (def) {
                def.reject(error);
                def = null;
            }
        });

        return def.promise;
    }

    private stop() {
        if (!this.httpServer) {
            return;
        }
        this.httpServer.close();
        this.httpServer = null;
    }
}