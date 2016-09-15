import {KernelManagerImpl} from './kernel-manager';
import {Kernel} from './kernel';
import * as vscode from 'vscode';
import {TextDocumentContentProvider} from './resultView';
import {JupyterDisplay} from './display/main';
import {KernelStatus} from './display/kernelStatus';

const anser = require('anser');

const jupyterSchema = 'jupyter-result-viewer';
let previewUri = vscode.Uri.parse(jupyterSchema + '://authority/jupyter');

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
function showResults(result: any): any {
    previewWindow.setText(result);
    if (displayed) {
        return previewWindow.update();
    }
    displayed = true;
    return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Three, 'Results')
        .then(() => { }, reason => {
            vscode.window.showErrorMessage(reason);
        });
}
export class Jupyter extends vscode.Disposable {
    public kernelManager: KernelManagerImpl;
    public editor: vscode.TextEditor;
    public kernel: Kernel = null;
    public markerBubbleMap = null;
    public watchSidebar = null;
    public watchSidebarIsVisible = false;
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
        this.markerBubbleMap = {};
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onEditorChanged.bind(this)));
        this.status = new KernelStatus();
        this.disposables.push(this.status);
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private onEditorChanged(editor) {
        // Opening display (results) documents causes event to fire
        if (!editor) {
            return;
        }
        let kernel;
        this.editor = editor;
        if (this.editor) {
            kernel = this.kernelManager.getRunningKernelFor(this.editor.document.languageId);
        }
        if (this.kernel !== kernel) {
            return this.onKernelChanged(kernel);
        }
    }
    private onKernalStatusChangeHandler: vscode.Disposable;
    onKernelChanged(kernel: Kernel) {
        // Unbind any previous handlers
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
    createResultBubble(code): Promise<any> {
        if (this.kernel) {
            return this.executeAndDisplay(this.kernel, code);
        }
        return this.kernelManager.startKernelFor(vscode.window.activeTextEditor.document.languageId)
            .then(kernel => {
                this.onKernelChanged(kernel);
                return this.executeAndDisplay(kernel, code);
            });
    }
    private executeAndDisplay(kernel: Kernel, code: string) {
        return this.executeCodeInKernel(kernel, code).then(result => {
            if (result.length === 0) {
                return;
            }
            return showResults(result);
        });
    }
    private executeCodeInKernel(kernel: Kernel, code: string): Promise<string> {
        return new Promise<any>((resolve, reject) => {
            let htmlResponse = '';
            return kernel.execute(code, (result: { type: string, stream: string, data: { [key: string]: string } | string }) => {
                if ((result.type === 'text' && result.stream === 'stdout' && typeof result.data['text/plain'] === 'string') ||
                    (result.type === 'text' && result.stream === 'pyout' && typeof result.data['text/plain'] === 'string') ||
                    (result.type === 'text' && result.stream === 'error' && typeof result.data['text/plain'] === 'string')) {
                    const htmlText = anser.ansiToHtml(anser.escapeForHtml(result.data['text/plain']));
                    // let rawError = htmlText.replace('\n', '<br/>');
                    htmlResponse = htmlResponse + `<p><pre>${htmlText}</pre></p>`;

                    if (result.stream === 'error') {
                        return resolve(htmlResponse);
                    }
                }
                if (result.type === 'text/html' && result.stream === 'pyout' && typeof result.data['text/html'] === 'string') {
                    htmlResponse = htmlResponse + result.data['text/html'];
                }
                if (result.type === 'application/javascript' && result.stream === 'pyout' && typeof result.data['application/javascript'] === 'string') {
                    // scripts.push(result.data['application/javascript']);
                    htmlResponse = htmlResponse + `<script type="text/javascript">${result.data['application/javascript']}</script>`;
                }
                if (result.type.startsWith('image/') && result.stream === 'pyout' && typeof result.data[result.type] === 'string') {
                    htmlResponse = htmlResponse + `<div style="background-color:white;display:inline-block;"><img src="data:${result.type};base64,${result.data[result.type]}" /></div><div></div>`;
                }
                if (result.data === 'ok' && result.stream === 'status' && result.type === 'text') {
                    resolve(htmlResponse);
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
        this.createResultBubble(code);

        // const decType = vscode.window.createTextEditorDecorationType({

        // });
        // activeEditor.setDecorations(decType, [activeEditor.selection]);

        // // create a decorator type that we use to decorate small numbers
        // let smallNumberDecorationType = vscode.window.createTextEditorDecorationType({
        //     borderWidth: '1px',
        //     borderStyle: 'none',
        //     outlineColor: 'red',
        //     outlineStyle: 'none',
        //     overviewRulerColor: 'blue',
        //     overviewRulerLane: vscode.OverviewRulerLane.Full,
        //     light: {
        //         // this color will be used in light color themes
        //         //backgroundColor: 'lightgrey'
        //     },
        //     dark: {
        //         // this color will be used in dark color themes
        //         //borderColor: 'lightblue',
        //         //backgroundColor: 'black'
        //     },
        //     isWholeLine: true,
        //     outlineWidth: '0',
        //     after: {
        //         contentText: 'End Cell',
        //         color: 'blue',
        //         backgroundColor: 'white'
        //     }
        //     // before: {
        //     //     color: 'blue',
        //     //     contentText: 'Start Cell [1][[<',
        //     //     backgroundColor: 'white'
        //     // }
        // });

        // // create a decorator type that we use to decorate large numbers
        // let largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
        //     cursor: 'crosshair',
        //     backgroundColor: 'rgba(255,0,0,0.3)'
        // });

        // let regEx = /\d+/g;
        // let text = activeEditor.document.getText();
        // let smallNumbers: vscode.DecorationOptions[] = [];
        // let largeNumbers: vscode.DecorationOptions[] = [];
        // let match;
        // while (match = regEx.exec(text)) {
        //     let startPos = activeEditor.document.positionAt(match.index);
        //     let endPos = activeEditor.document.positionAt(match.index + match[0].length);
        //     let decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Number **' + match[0] + '**' };
        //     if (match[0].length < 3) {
        //         smallNumbers.push(decoration);
        //     } else {
        //         largeNumbers.push(decoration);
        //     }

        // }
        // let options: vscode.DecorationOptions = {
        //     range: activeEditor.selection,
        //     hoverMessage: 'Result Displayed'
        // };

        // activeEditor.setDecorations(smallNumberDecorationType, [options]);
        // // activeEditor.setDecorations(largeNumberDecorationType, largeNumbers);
    }
};