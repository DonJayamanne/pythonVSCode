'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('flake8', Product.flake8, outputChannel, workspaceRootPath);
    }

    private parseMessagesCodeSeverity(error: string): baseLinter.LintMessageSeverity {

        let category_letter = error[0];
        switch (category_letter) {
            case 'F':
            case 'E':
                return baseLinter.LintMessageSeverity.Error;
            case 'W':
                return baseLinter.LintMessageSeverity.Warning;
            default:
                return baseLinter.LintMessageSeverity.Information;
        }
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
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesCodeSeverity(msg.type);
                });

                resolve(messages);
            }, reject);
        });
    }
}
