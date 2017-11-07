'use strict';

import * as vscode from 'vscode';
import { BaseFormatter } from './baseFormatter';
import { Product } from '../common/installer';

export class DummyFormatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('none', Product.yapf, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        return Promise.resolve([]);
    }
}
