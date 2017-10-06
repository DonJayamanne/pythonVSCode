"use strict";

// Solution for auto-formatting borrowed from the "go" language VSCode extension.

import * as vscode from "vscode";
import { BaseFormatter } from "./../formatters/baseFormatter";
import { YapfFormatter } from "./../formatters/yapfFormatter";
import { AutoPep8Formatter } from "./../formatters/autoPep8Formatter";
import { DummyFormatter } from "./../formatters/dummyFormatter";
import * as settings from "./../common/configSettings";

export function activateFormatOnSaveProvider(languageFilter: vscode.DocumentFilter, settings: settings.IPythonSettings, outputChannel: vscode.OutputChannel): vscode.Disposable {
    let formatters = new Map<string, BaseFormatter>();
    let pythonSettings = settings;

    let yapfFormatter = new YapfFormatter(outputChannel, settings);
    let autoPep8 = new AutoPep8Formatter(outputChannel, settings);
    const dummyFormatter = new DummyFormatter(outputChannel, settings);

    formatters.set(yapfFormatter.Id, yapfFormatter);
    formatters.set(autoPep8.Id, autoPep8);
    formatters.set(dummyFormatter.Id, dummyFormatter);

    return vscode.workspace.onWillSaveTextDocument(e => {
        const document = e.document;
        if (document.languageId !== languageFilter.language) {
            return;
        }
        let textEditor = vscode.window.activeTextEditor;
        let editorConfig = vscode.workspace.getConfiguration('editor');
        const globalEditorFormatOnSave = editorConfig && editorConfig.has('formatOnSave') && editorConfig.get('formatOnSave') === true;
        if ((pythonSettings.formatting.formatOnSave || globalEditorFormatOnSave) && textEditor.document === document) {
            let formatter = formatters.get(pythonSettings.formatting.provider);
            e.waitUntil(formatter.formatDocument(document, null, null));
        }
    }, null, null);
}
