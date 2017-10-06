'use strict';

import * as vscode from 'vscode';
import { BaseFormatter } from './baseFormatter';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';

export class AutoPep8Formatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('autopep8', Product.autopep8, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const settings = PythonSettings.getInstance(document.uri);
        const autopep8Path = settings.formatting.autopep8Path;
        let autoPep8Args = Array.isArray(settings.formatting.autopep8Args) ? settings.formatting.autopep8Args : [];
        autoPep8Args = autoPep8Args.concat(['--diff']);
        if (range && !range.isEmpty) {
            autoPep8Args = autoPep8Args.concat(['--line-range', (range.start.line + 1).toString(), (range.end.line + 1).toString()]);
        }
        return super.provideDocumentFormattingEdits(document, options, token, autopep8Path, autoPep8Args);
    }
}
