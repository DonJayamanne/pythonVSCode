import * as vscode from 'vscode';
import {TextDocumentContentProvider} from './resultView';

const anser = require('anser');

const jupyterSchema = 'jupyter-result-viewer';
let previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

let previewWindow: TextDocumentContentProvider;

export class Results extends vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private resultProvider: TextDocumentContentProvider;

    constructor() {
        super(() => { });
        this.resultProvider = new TextDocumentContentProvider();
        this.disposables.push(vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, previewWindow));
    }

    public displayProgress() {

    }

    public clearResults() {

    }

    public appendResult() {

    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}