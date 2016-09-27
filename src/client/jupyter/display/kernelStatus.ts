import * as vscode from 'vscode';
import {KernelspecMetadata} from '../contracts';
import {Commands, PythonLanguage} from '../../common/constants';

export class KernelStatus extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private statusBar: vscode.StatusBarItem;

    constructor() {
        super(() => { });
        this.disposables = [];
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBar.command = 'jupyter:proxyKernelOptionsCmd';
        this.disposables.push(this.statusBar);
        this.disposables.push(vscode.commands.registerCommand('jupyter:proxyKernelOptionsCmd', () => {
            vscode.commands.executeCommand(Commands.Jupyter.Kernel_Options, this.activeKernalDetails);
        }));

        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor.bind(this)));
    }

    private onDidChangeActiveTextEditor(editor: vscode.TextEditor) {
        const editorsOpened = vscode.workspace.textDocuments.length > 0;
        if ((!editor && editorsOpened) || (editor && editor.document.languageId === PythonLanguage.language)) {
            if (this.activeKernalDetails) {
                this.statusBar.show();
            }
        }
        else {
            this.statusBar.hide();
        }
    }
    private activeKernalDetails: KernelspecMetadata;
    public setActiveKernel(kernelspec: KernelspecMetadata) {
        if (!kernelspec) {
            this.activeKernalDetails = null;
            return this.statusBar.hide();
        }
        this.activeKernalDetails = kernelspec;
        this.statusBar.text = `$(flame)${this.activeKernalDetails.display_name} Kernel`;
        this.statusBar.tooltip = `${kernelspec.display_name} Kernel for ${kernelspec.language}\nClick for options`;
        this.statusBar.show();
    }
    public setKernelStatus(status: string) {
        this.statusBar.text = `$(flame)${this.activeKernalDetails.display_name} Kernel (${status})`;
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}