import {KernelManagerImpl} from './kernel-manager';
import {Kernel} from './kernel';
import * as vscode from 'vscode';
import {TextDocumentContentProvider} from './resultView';
import {JupyterDisplay} from './display/main';
import {KernelStatus} from './display/kernelStatus';
import {Commands} from '../common/constants';

const anser = require('anser');

const jupyterSchema = 'jupyter-result-viewer';
const previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

let previewWindow: TextDocumentContentProvider;
let display: JupyterDisplay;
export function activate(): vscode.Disposable[] {
    previewWindow = new TextDocumentContentProvider();
    let disposables: vscode.Disposable[] = [];
    disposables.push(vscode.workspace.registerTextDocumentContentProvider(jupyterSchema, previewWindow));
    display = new JupyterDisplay();
    disposables.push(display);
    return disposables;
}

let displayed = false;
function showResults(result: string, data: any): any {
    previewWindow.setText(result, data);
    // Dirty hack to support instances when document has been closed
    if (displayed) {
        previewWindow.update();
    }
    displayed = true;
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'Results')
        .then(() => {
            if (displayed) {
                previewWindow.update();
            }
         }, reason => {
            vscode.window.showErrorMessage(reason);
        });
}
export class Jupyter extends vscode.Disposable {
    public kernelManager: KernelManagerImpl;
    public kernel: Kernel = null;
    private status: KernelStatus;
    private disposables: vscode.Disposable[];

    constructor() {
        super(() => { });
        this.disposables = [];
    }
    activate(state) {
        this.disposables.push(...activate());
        this.kernelManager = new KernelManagerImpl();
        this.disposables.push(this.kernelManager);
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this)));
        this.status = new KernelStatus();
        this.disposables.push(this.status);
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private onEditorChanged(editor: vscode.TextEditor) {
        if (!editor || !editor.document) {
            return;
        }
        const kernel = this.kernelManager.getRunningKernelFor(editor.document.languageId);
        if (this.kernel !== kernel) {
            return this.onKernelChanged(kernel);
        }
    }
    private onKernalStatusChangeHandler: vscode.Disposable;
    onKernelChanged(kernel?: Kernel) {
        if (this.onKernalStatusChangeHandler) {
            this.onKernalStatusChangeHandler.dispose();
            this.onKernalStatusChangeHandler = null;
        }
        if (kernel) {
            this.onKernalStatusChangeHandler = kernel.onStatusChange(statusInfo => {
                this.status.setKernelStatus(statusInfo[1]);
            });
        }
        this.kernel = kernel;
        this.status.setActiveKernel(this.kernel ? this.kernel.kernelSpec : null);
    }
    executeCode(code: string, language: string): Promise<any> {
        if (this.kernel && this.kernel.kernelSpec.language === language) {
            return this.executeAndDisplay(this.kernel, code);
        }
        return this.kernelManager.startKernelFor(language)
            .then(kernel => {
                this.onKernelChanged(kernel);
                return this.executeAndDisplay(kernel, code);
            });
    }
    private executeAndDisplay(kernel: Kernel, code: string) {
        return this.executeCodeInKernel(kernel, code).then(result => {
            if (result[0].length === 0) {
                return;
            }
            return showResults(result[0], result[1]);
        });
    }
    private executeCodeInKernel(kernel: Kernel, code: string): Promise<string> {
        return new Promise<any>((resolve, reject) => {
            let htmlResponse = '';
            let responses = [];
            return kernel.execute(code, (result: { type: string, stream: string, data: { [key: string]: string } | string }) => {
                if ((result.type === 'text' && result.stream === 'stdout' && typeof result.data['text/plain'] === 'string') ||
                    (result.type === 'text' && result.stream === 'pyout' && typeof result.data['text/plain'] === 'string') ||
                    (result.type === 'text' && result.stream === 'error' && typeof result.data['text/plain'] === 'string')) {
                    const htmlText = anser.ansiToHtml(anser.escapeForHtml(result.data['text/plain']));
                    htmlResponse = htmlResponse + `<p><pre>${htmlText}</pre></p>`;
                    responses.push(result.data);
                    if (result.stream === 'error') {
                        return resolve([htmlResponse, responses]);
                    }
                }
                if (result.type === 'text/html' && result.stream === 'pyout' && typeof result.data['text/html'] === 'string') {
                    htmlResponse = htmlResponse + result.data['text/html'];
                    result.data['text/html'] = result.data['text/html'].replace(/<\/script>/g, '</scripts>');
                    responses.push(result.data);
                }
                if (result.type === 'application/javascript' && result.stream === 'pyout' && typeof result.data['application/javascript'] === 'string') {
                    responses.push(result.data);
                    htmlResponse = htmlResponse + `<script type="text/javascript">${result.data['application/javascript']}</script>`;
                }
                if (result.type.startsWith('image/') && result.stream === 'pyout' && typeof result.data[result.type] === 'string') {
                    responses.push(result.data);
                    htmlResponse = htmlResponse + `<div style="background-color:white;display:inline-block;"><img src="data:${result.type};base64,${result.data[result.type]}" /></div><div></div>`;
                }
                if (result.data === 'ok' && result.stream === 'status' && result.type === 'text') {
                    resolve([htmlResponse, responses]);
                }
            });
        });
    }
    executeSelection() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return;
        }
        const code = activeEditor.document.getText(vscode.window.activeTextEditor.selection);
        this.executeCode(code, activeEditor.document.languageId);
    }
    private registerKernelCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Kernel_Interrupt, () => {
            this.kernel.interrupt();
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Kernel_Restart, () => {
            this.kernelManager.restartRunningKernelFor(this.kernel.kernelSpec.language).then(kernel => {
                this.onKernelChanged(kernel);
            });
        }));
        this.disposables.push(vscode.commands.registerCommand(Commands.Jupyter.Kernel.Kernel_Interrupt, () => {
            this.kernel.shutdown();
            this.onKernelChanged();
        }));
    }
};