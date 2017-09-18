import * as vscode from 'vscode';

export class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
    }
    name: string;
    output: string;
    isShown: boolean;
    append(value: string) {
        this.output += value;
    }
    appendLine(value: string) { this.append(value); this.append('\n'); }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void {
        this.isShown = true;
    }
    hide() {
        this.isShown = false;
    }
    dispose() { }
}

export class MockStatusBarItem implements vscode.StatusBarItem {
    public alignment: vscode.StatusBarAlignment;
    public priority: number;
    public text: string;
    public tooltip: string;
    public color: string;
    public command: string;
    show(): void {

    }
    hide(): void {

    }
    dispose(): void {

    }
}