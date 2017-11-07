'use strict';

import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';
import {  sendTelemetryWhenDone} from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { StopWatch } from '../telemetry/stopWatch';
import { BaseFormatter } from './baseFormatter';

export class YapfFormatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('yapf', Product.yapf, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = PythonSettings.getInstance(document.uri);
        const yapfPath = settings.formatting.yapfPath;
        const yapfArgs = Array.isArray(settings.formatting.yapfArgs) ? settings.formatting.yapfArgs : [];
        const hasCustomArgs = yapfArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        yapfArgs.push('--diff');
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            yapfArgs.push(...['--lines', `${range!.start.line + 1}-${range!.end.line + 1}`]);
        }
        // Yapf starts looking for config file starting from the file path.
        const fallbarFolder = this.getWorkspaceUri(document).fsPath;
        const cwd = this.getDocumentPath(document, fallbarFolder);
        const promise = super.provideDocumentFormattingEdits(document, options, token, yapfPath, yapfArgs, cwd);
        sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'yapf', hasCustomArgs, formatSelection });
        return promise;
    }
}
