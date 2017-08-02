'use strict';
import { OutputChannel } from 'vscode';
import { Installer, Product, disableLinter } from '../../common/installer';
import * as vscode from 'vscode';

export class StandardErrorHandler {
    constructor(protected id: string, protected product: Product, protected installer: Installer, protected outputChannel: OutputChannel) {

    }
    private displayLinterError() {
        const message = `There was an error in running the linter '${this.id}'`;
        vscode.window.showErrorMessage(message, 'Disable linter', 'View Errors').then(item => {
            switch (item) {
                case 'Disable linter': {
                    disableLinter(this.product);
                    break;
                }
                case 'View Errors': {
                    this.outputChannel.show();
                    break;
                }
            }
        });
    }

    public handleError(expectedFileName: string, fileName: string, error: Error): boolean {
        if (typeof error === 'string' && (error as string).indexOf("OSError: [Errno 2] No such file or directory: '/") > 0) {
            return false;
        }
        console.error('There was an error in running the linter');
        console.error(error);

        this.outputChannel.appendLine(`Linting with ${this.id} failed.\n${error + ''}`);
        this.displayLinterError();
        return true;
    }
}
