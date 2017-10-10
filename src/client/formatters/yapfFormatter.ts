'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseFormatter } from './baseFormatter';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';

export class YapfFormatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('yapf', Product.yapf, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const settings = PythonSettings.getInstance(document.uri);
        const yapfPath = settings.formatting.yapfPath;
        let yapfArgs = Array.isArray(settings.formatting.yapfArgs) ? settings.formatting.yapfArgs : [];
        yapfArgs = yapfArgs.concat(['--diff']);
        if (range && !range.isEmpty) {
            yapfArgs = yapfArgs.concat(['--lines', `${range.start.line + 1}-${range.end.line + 1}`]);
        }
        // Yapf starts looking for config file starting from the file path
        const fallbarFolder = this.getWorkspaceUri(document).fsPath;
        const cwd = this.getDocumentPath(document, fallbarFolder);
        return super.provideDocumentFormattingEdits(document, options, token, yapfPath, yapfArgs, cwd);
    }
}
