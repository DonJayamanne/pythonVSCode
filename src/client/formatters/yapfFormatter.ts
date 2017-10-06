'use strict';

import * as vscode from 'vscode';
import { BaseFormatter } from './baseFormatter';
import * as settings from './../common/configSettings';
import { Product } from '../common/installer';
import * as path from 'path';

export class YapfFormatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel, pythonSettings: settings.IPythonSettings) {
        super('yapf', Product.yapf, outputChannel, pythonSettings);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        let yapfPath = this.pythonSettings.formatting.yapfPath;
        let yapfArgs = Array.isArray(this.pythonSettings.formatting.yapfArgs) ? this.pythonSettings.formatting.yapfArgs : [];
        yapfArgs = yapfArgs.concat(['--diff']);
        if (range && !range.isEmpty) {
            yapfArgs = yapfArgs.concat(['--lines', `${range.start.line + 1}-${range.end.line + 1}`]);
        }
        // Yapf starts looking for config file starting from the file path
        let cwd = path.dirname(document.fileName);
        return super.provideDocumentFormattingEdits(document, options, token, yapfPath, yapfArgs, cwd);
    }
}
