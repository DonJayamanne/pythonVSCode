'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

const REGEX = '(?<file>.py):(?<line>\\d+): (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel) {
        super('mypy', Product.mypy, outputChannel);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.mypyEnabled;
    }
    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.mypyEnabled) {
            return Promise.resolve([]);
        }

        let mypyPath = this.pythonSettings.linting.mypyPath;
        let mypyArgs = Array.isArray(this.pythonSettings.linting.mypyArgs) ? this.pythonSettings.linting.mypyArgs : [];
        
        if (mypyArgs.length === 0 && ProductExecutableAndArgs.has(Product.mypy) && mypyPath.toLocaleLowerCase() === 'mypy'){
            mypyPath = ProductExecutableAndArgs.get(Product.mypy).executable;
            mypyArgs = ProductExecutableAndArgs.get(Product.mypy).args;
        }

        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(mypyPath, mypyArgs.concat([document.uri.fsPath]), document, this.getWorkspaceRootPath(document), cancellation, REGEX).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
                    msg.code = msg.type;
                });

                resolve(messages);
            }, reject);
        });
    }
}
