import * as vscode from 'vscode';
import {KernelPicker} from './kernelPicker';

export class JupyterDisplay extends vscode.Disposable {
    private disposables: vscode.Disposable[];
    constructor() {
        super(() => { });
        this.disposables = [];
        this.disposables.push(new KernelPicker());
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}