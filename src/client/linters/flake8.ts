'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('flake8', Product.flake8, outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.flake8Enabled;
    }
    public runLinter(document: TextDocument): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.flake8Enabled) {
            return Promise.resolve([]);
        }

        let flake8Path = this.pythonSettings.linting.flake8Path;
        let flake8Args = Array.isArray(this.pythonSettings.linting.flake8Args) ? this.pythonSettings.linting.flake8Args : [];
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(flake8Path, flake8Args.concat(['--format=%(row)d,%(col)d,%(code)s,%(code)s:%(text)s', document.uri.fsPath]), document, this.workspaceRootPath).then(messages => {
                // All messages in pep8 are treated as warnings for now
                messages.forEach(msg => {
                    msg.severity = baseLinter.LintMessageSeverity.Information;
                });

                resolve(messages);
            }, reject);
        });
    }
}
