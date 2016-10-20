'use strict';

import * as baseLinter from './baseLinter';
import {OutputChannel} from 'vscode';
import { Product } from '../common/installer';

const REGEX = '(?<file>.py):(?<line>\\d+): (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath: string) {
        super('mypy', Product.mypy, outputChannel, workspaceRootPath);
    }
    private parseMessagesSeverity(category: string): baseLinter.LintMessageSeverity {
        switch (category) {
            case 'error': {
                return baseLinter.LintMessageSeverity.Error;
            }
            case 'note': {
                return baseLinter.LintMessageSeverity.Hint;
            }
            default: {
                return baseLinter.LintMessageSeverity.Information;
            }
        }
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.mypyEnabled;
    }
    public runLinter(filePath: string, txtDocumentLines: string[]): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.mypyEnabled) {
            return Promise.resolve([]);
        }

        let mypyPath = this.pythonSettings.linting.mypyPath;
        let mypyArgs = Array.isArray(this.pythonSettings.linting.mypyArgs) ? this.pythonSettings.linting.mypyArgs : [];
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            this.run(mypyPath, mypyArgs.concat([filePath]), filePath, txtDocumentLines, this.workspaceRootPath, REGEX).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type);
                    msg.code = msg.type;
                });

                resolve(messages);
            }, reject);
        });
    }
}