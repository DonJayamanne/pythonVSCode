'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('pylint', Product.pylint, outputChannel, workspaceRootPath);
    }

    private parseMessagesSeverity(category: string): baseLinter.LintMessageSeverity {
        if (this.pythonSettings.linting.pylintCategorySeverity[category]) {
            let severityName = this.pythonSettings.linting.pylintCategorySeverity[category];
            switch (severityName) {
                case 'Error':
                    return baseLinter.LintMessageSeverity.Error;
                case 'Hint':
                    return baseLinter.LintMessageSeverity.Hint;
                case 'Information':
                    return baseLinter.LintMessageSeverity.Information;
                case 'Warning':
                    return baseLinter.LintMessageSeverity.Warning;
                default: {
                    if (baseLinter.LintMessageSeverity[severityName]) {
                        return <baseLinter.LintMessageSeverity><any>baseLinter.LintMessageSeverity[severityName];
                    }
                }
            }
        }

        return baseLinter.LintMessageSeverity.Information;
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.pylintEnabled;
    }
    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pylintEnabled) {
            return Promise.resolve([]);
        }

        let pylintPath = this.pythonSettings.linting.pylintPath;
        let pylintArgs = Array.isArray(this.pythonSettings.linting.pylintArgs) ? this.pythonSettings.linting.pylintArgs : [];
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(pylintPath, pylintArgs.concat(['--msg-template=\'{line},{column},{category},{msg_id}:{msg}\'', '--reports=n', '--output-format=text', document.uri.fsPath]), document, this.workspaceRootPath, cancellation).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type);
                });

                resolve(messages);
            }, reject);
        });
    }
}