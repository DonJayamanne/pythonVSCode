import * as vscode from 'vscode';
import { TEST_TIMEOUT } from './../initialize';

export class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
        this.timeOut = setTimeout(() => {
            console.log(this.output);
            this.writeToConsole = true;
            this.timeOut = null;
        }, TEST_TIMEOUT - 1000);
    }
    private timeOut: number;
    name: string;
    output: string;
    isShown: boolean;
    private writeToConsole: boolean;
    append(value: string) {
        this.output += value;
        if (this.writeToConsole) {
            console.log(value);
        }
    }
    appendLine(value: string) {
        this.append(value); this.append('\n');
        if (this.writeToConsole) {
            console.log(value);
            console.log('\n');
        }
    }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void {
        this.isShown = true;
    }
    hide() {
        this.isShown = false;
    }
    dispose() {
        if (this.timeOut) {
            clearTimeout(this.timeOut);
            this.timeOut = null;
        }
    }
}
