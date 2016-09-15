import * as vscode from 'vscode';
import {KernelspecMetadata} from '../contracts';

export class KernelStatus extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    private statusBar: vscode.StatusBarItem;

    constructor() {
        super(() => { });
        this.disposables = [];
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.disposables.push(this.statusBar);
    }
    private activeKernalDetails: string;
    public setActiveKernel(kernelspec: KernelspecMetadata) {
        this.activeKernalDetails = this.statusBar.text = `${kernelspec.display_name} Kernel`;
    }
    public setKernelStatus(status: string) {
        this.statusBar.text = `${this.activeKernalDetails} (${status})`;
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}