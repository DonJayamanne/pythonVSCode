'use strict';

import * as vscode from 'vscode';
import { BaseFormatter } from './baseFormatter';
import * as settings from '../common/configSettings';
import { Product } from '../common/installer';

export class AutoPep8Formatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel, pythonSettings: settings.IPythonSettings, workspaceRootPath?: string) {
        super('autopep8', Product.autopep8, outputChannel, pythonSettings, workspaceRootPath);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        let autopep8Path = this.pythonSettings.formatting.autopep8Path;
        let autoPep8Args = Array.isArray(this.pythonSettings.formatting.autopep8Args) ? this.pythonSettings.formatting.autopep8Args : [];
        autoPep8Args = autoPep8Args.concat(['--diff']);
        if (range && !range.isEmpty) {
            autoPep8Args = autoPep8Args.concat(['--line-range', (range.start.line + 1).toString(), (range.end.line + 1).toString()]);
        }
        return super.provideDocumentFormattingEdits(document, options, token, autopep8Path, autoPep8Args);
    }
}