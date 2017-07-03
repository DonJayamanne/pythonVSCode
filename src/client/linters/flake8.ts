'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;

    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('flake8', Product.flake8, outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.flake8Enabled;
    }
    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.flake8Enabled) {
            return Promise.resolve([]);
        }

        let flake8Path = this.pythonSettings.linting.flake8Path;
        let flake8Args = Array.isArray(this.pythonSettings.linting.flake8Args) ? this.pythonSettings.linting.flake8Args : [];
        
        if (flake8Args.length === 0 && ProductExecutableAndArgs.has(Product.flake8)){
            flake8Path = ProductExecutableAndArgs.get(Product.flake8).executable;
            flake8Args = ProductExecutableAndArgs.get(Product.flake8).args;
        }
        
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(flake8Path, flake8Args.concat(['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', document.uri.fsPath]), document, this.workspaceRootPath, cancellation).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.flake8CategorySeverity);
                });

                resolve(messages);
            }, reject);
        });
    }
}
