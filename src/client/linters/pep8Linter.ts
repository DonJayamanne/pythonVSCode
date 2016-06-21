'use strict';

import * as path from 'path';
import * as baseLinter from './baseLinter';
import {OutputChannel, workspace} from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath: string) {
        super("pep8", outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.pep8Enabled;
    }
    public runLinter(filePath: string, txtDocumentLines: string[]): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pep8Enabled) {
            return Promise.resolve([]);
        }

        var pep8Path = this.pythonSettings.linting.pep8Path;
        return new Promise<baseLinter.ILintMessage[]>(resolve => {
            this.run(pep8Path, ["--format='%(row)d,%(col)d,%(code)s,%(code)s:%(text)s'", filePath], filePath, txtDocumentLines, this.workspaceRootPath).then(messages => {
                //All messages in pep8 are treated as warnings for now
                messages.forEach(msg => {
                    msg.severity = baseLinter.LintMessageSeverity.Information;
                });

                resolve(messages);
            });
        });
    }
}
