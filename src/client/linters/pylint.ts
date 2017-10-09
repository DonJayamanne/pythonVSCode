'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel) {
        super('pylint', Product.pylint, outputChannel);
    }

    protected runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pylintEnabled) {
            return Promise.resolve([]);
        }

        let pylintPath = this.pythonSettings.linting.pylintPath;
        let pylintArgs = Array.isArray(this.pythonSettings.linting.pylintArgs) ? this.pythonSettings.linting.pylintArgs : [];

        if (pylintArgs.length === 0 && ProductExecutableAndArgs.has(Product.pylint) && pylintPath === 'pylint') {
            pylintPath = ProductExecutableAndArgs.get(Product.pylint).executable;
            pylintArgs = ProductExecutableAndArgs.get(Product.pylint).args;
        }

        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(pylintPath, pylintArgs.concat(['--msg-template=\'{line},{column},{category},{msg_id}:{msg}\'', '--reports=n', '--output-format=text', document.uri.fsPath]), document, this.getWorkspaceRootPath(document), cancellation).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
                });

                resolve(messages);
            }, reject);
        });
    }
}
