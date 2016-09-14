import {KernelManager} from './kernel-manager';
import {Kernel} from './kernel';
import * as vscode from 'vscode';
import {TextDocumentContentProvider} from './resultView';

const jupyterSchema = 'jupyter-result-viewer';
let previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

let previewWindow: TextDocumentContentProvider;
export function activate(): vscode.Disposable {
    previewWindow = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, previewWindow);
    return registration;
}

let displayed = false;
function showResults(result: any): any {
    if (displayed) {
        return previewWindow.update(result);
    }
    displayed = true;
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Three, 'Results')
        .then(() => { }, reason => {
            vscode.window.showErrorMessage(reason);
        });
}
export class Jupyter {
    public subscriptions = null;
    public kernelManager: KernelManager;
    public editor: vscode.TextEditor;
    public kernel: Kernel = null;
    public markerBubbleMap = null;
    public statusBarElement = null;
    public statusBarTile = null;
    public watchSidebar = null;
    public watchSidebarIsVisible = false;

    activate(state) {
        activate();
        this.kernelManager = new KernelManager();
        this.markerBubbleMap = {};
        vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this));
    }
    deactivate() {
        this.subscriptions.dispose();
        this.kernelManager.destroy();
        return this.statusBarTile.destroy();
    }
    onEditorChanged(editor) {
        let kernel;
        this.editor = editor;
        if (this.editor) {
            kernel = this.kernelManager.getRunningKernelFor(this.editor.document.languageId);
        }
        if (this.kernel !== kernel) {
            return this.onKernelChanged(kernel);
        }
    }
    onKernelChanged(kernel1?) {
        this.kernel = kernel1;
    }
    createResultBubble(code, row) {
        if (this.kernel) {
            this.executeAndDisplay(this.kernel, code, row);
            return;
        }
        return this.kernelManager.startKernelFor(vscode.window.activeTextEditor.document.languageId, (function (_this) {
            return function (kernel) {
                _this.onKernelChanged(kernel);
                return _this._createResultBubble(kernel, code, row);
            };
        })(this));
    }
    private executeAndDisplay(kernel: Kernel, code, row) {
        this.executeCodeInKernel(kernel, code).then(result => {
            showResults(result);
        });
    }
    private executeCodeInKernel(kernel: Kernel, code: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let htmlResponse = '';
            return kernel.execute(code, function (result: { type: string, stream: string, data: { [key: string]: string } | string }) {
                if (result.type === 'text' && result.stream === 'stdout' && typeof result.data['text/plain'] === 'string') {
                    htmlResponse = htmlResponse + `<p><pre>${result.data['text/plain']}</pre></p>`;
                }
                if (result.type === 'text' && result.stream === 'pyout' && typeof result.data['text/plain'] === 'string') {
                    htmlResponse = htmlResponse + `<p><pre>${result.data['text/plain']}</pre></p>`;
                }
                if (result.type === 'text/html' && result.stream === 'pyout' && typeof result.data['text/html'] === 'string') {
                    htmlResponse = htmlResponse + result.data['text/html'];
                }
                if (result.type === 'application/javascript' && result.stream === 'pyout' && typeof result.data['application/javascript'] === 'string') {
                    // scripts.push(result.data['application/javascript']);
                }
                if (result.type.startsWith('image/') && result.stream === 'pyout' && typeof result.data[result.type] === 'string') {
                    htmlResponse = htmlResponse + `<img src="data:${result.type};base64,${result.data[result.type]}" />`
                }
                if (result.data === 'ok' && result.stream === 'status' && result.type === 'text') {
                    resolve(htmlResponse);
                }
            });
        });
    }
    executeSelection() {
        const code = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.selection)
        this.createResultBubble(code, null)
    }
};