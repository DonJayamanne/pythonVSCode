'use strict';

import * as baseLinter from './baseLinter';
import {OutputChannel} from 'vscode';
import { Product } from '../common/installer';

const REGEX = '(?<file>.py):(?<line>\\d+):(?<column>\\d+): \\[(?<type>\\w+)\\] (?<code>\\w\\d+):? (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('pylama', Product.pylama, outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.pylamaEnabled;
    }
    public runLinter(filePath: string, txtDocumentLines: string[]): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pylamaEnabled) {
            return Promise.resolve([]);
        }

        let pylamaPath = this.pythonSettings.linting.pylamaPath;
        let pylamaArgs = Array.isArray(this.pythonSettings.linting.pylamaArgs) ? this.pythonSettings.linting.pylamaArgs : [];
        return new Promise<baseLinter.ILintMessage[]>(resolve => {
            this.run(pylamaPath, pylamaArgs.concat(['--format=parsable', filePath]), filePath, txtDocumentLines, this.workspaceRootPath, REGEX).then(messages => {
                // All messages in pylama are treated as warnings for now
                messages.forEach(msg => {
                    msg.severity = baseLinter.LintMessageSeverity.Information;
                });

                resolve(messages);
            });
        });
    }
}
