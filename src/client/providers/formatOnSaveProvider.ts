"use strict";

// Solution for auto-formatting borrowed from the "go" language VSCode extension.

import * as vscode from "vscode";
import { BaseFormatter } from "./../formatters/baseFormatter";
import { YapfFormatter } from "./../formatters/yapfFormatter";
import { AutoPep8Formatter } from "./../formatters/autoPep8Formatter";
import { DummyFormatter } from "./../formatters/dummyFormatter";
import { PythonSettings } from "./../common/configSettings";

export function activateFormatOnSaveProvider(languageFilter: vscode.DocumentFilter, outputChannel: vscode.OutputChannel): vscode.Disposable {
    const formatters = new Map<string, BaseFormatter>();
    const yapfFormatter = new YapfFormatter(outputChannel);
    const autoPep8 = new AutoPep8Formatter(outputChannel);
    const dummyFormatter = new DummyFormatter(outputChannel);

    formatters.set(yapfFormatter.Id, yapfFormatter);
    formatters.set(autoPep8.Id, autoPep8);
    formatters.set(dummyFormatter.Id, dummyFormatter);

    return vscode.workspace.onWillSaveTextDocument(e => {
        const document = e.document;
        if (document.languageId !== languageFilter.language) {
            return;
        }
        const textEditor = vscode.window.activeTextEditor;
        const editorConfig = vscode.workspace.getConfiguration('editor');
        const globalEditorFormatOnSave = editorConfig && editorConfig.has('formatOnSave') && editorConfig.get('formatOnSave') === true;
        const settings = PythonSettings.getInstance(document.uri);
        if ((settings.formatting.formatOnSave || globalEditorFormatOnSave) && textEditor.document === document) {
            const formatter = formatters.get(settings.formatting.provider);
            e.waitUntil(formatter.formatDocument(document, null, null));
        }
    }, null, null);
}
