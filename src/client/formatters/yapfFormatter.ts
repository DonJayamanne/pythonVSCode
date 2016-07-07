'use strict';

import * as vscode from 'vscode';
import {BaseFormatter} from './baseFormatter';
import * as settings from './../common/configSettings';

export class YapfFormatter extends BaseFormatter {
    constructor(protected outputChannel: vscode.OutputChannel, protected pythonSettings: settings.IPythonSettings, protected workspaceRootPath: string) {
        super('yapf', outputChannel, pythonSettings, workspaceRootPath);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        let yapfPath = this.pythonSettings.formatting.yapfPath;
        let yapfArgs = Array.isArray(this.pythonSettings.formatting.yapfArgs) ? this.pythonSettings.formatting.yapfArgs : [];
        yapfArgs = yapfArgs.concat(['--diff']);
        if (range && !range.isEmpty) {
            yapfArgs = yapfArgs.concat(['--lines', `${range.start.line + 1}-${range.end.line + 1}`]);
        }
        return super.provideDocumentFormattingEdits(document, options, token, yapfPath, yapfArgs);
    }
}