'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;
    
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('pep8', Product.pep8, outputChannel, workspaceRootPath);
    }

    private parseMessagesCodeSeverity(error: string): baseLinter.LintMessageSeverity {

        let category_letter = error[0];
        switch (category_letter) {
            case 'E':
                return baseLinter.LintMessageSeverity.Error;
            case 'W':
                return baseLinter.LintMessageSeverity.Warning;
            default:
                return baseLinter.LintMessageSeverity.Information;
        }
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.pep8Enabled;
    }
    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pep8Enabled) {
            return Promise.resolve([]);
        }

        let pep8Path = this.pythonSettings.linting.pep8Path;
        let pep8Args = Array.isArray(this.pythonSettings.linting.pep8Args) ? this.pythonSettings.linting.pep8Args : [];
        return new Promise<baseLinter.ILintMessage[]>(resolve => {
            this.run(pep8Path, pep8Args.concat(['--format=%(row)d,%(col)d,%(code)s,%(code)s:%(text)s', document.uri.fsPath]), document, this.workspaceRootPath, cancellation).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesCodeSeverity(msg.type);
                });

                resolve(messages);
            });
        });
    }
}
