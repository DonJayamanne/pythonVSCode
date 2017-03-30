'use strict';

import * as vscode from 'vscode';
import { BaseFormatter } from './../formatters/baseFormatter';
import { YapfFormatter } from './../formatters/yapfFormatter';
import { AutoPep8Formatter } from './../formatters/autoPep8Formatter';
import { DummyFormatter } from './../formatters/dummyFormatter';
import * as settings from './../common/configSettings';

export class PythonFormattingEditProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
    private formatters = new Map<string, BaseFormatter>();

    public constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, private settings: settings.IPythonSettings) {
        let yapfFormatter = new YapfFormatter(outputChannel, settings);
        let autoPep8 = new AutoPep8Formatter(outputChannel, settings);
        let dummy = new DummyFormatter(outputChannel, settings);
        this.formatters.set(yapfFormatter.Id, yapfFormatter);
        this.formatters.set(autoPep8.Id, autoPep8);
        this.formatters.set(dummy.Id, dummy);
    }

    public provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        return this.provideDocumentRangeFormattingEdits(document, null, options, token);
    }

    public provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): Thenable<vscode.TextEdit[]> {
        let formatter = this.formatters.get(this.settings.formatting.provider);
        return formatter.formatDocument(document, options, token, range);
    }

}
