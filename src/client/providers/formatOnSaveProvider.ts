"use strict";

// Solution for auto-formatting borrowed from the "go" language VSCode extension.

import * as vscode from "vscode";
import { BaseFormatter } from "./../formatters/baseFormatter";
import { YapfFormatter } from "./../formatters/yapfFormatter";
import { AutoPep8Formatter } from "./../formatters/autoPep8Formatter";
import * as settings from "./../common/configSettings";
import * as telemetryHelper from "../common/telemetry";
import * as telemetryContracts from "../common/telemetryContracts";

export function activateFormatOnSaveProvider(languageFilter: vscode.DocumentFilter, settings: settings.IPythonSettings, outputChannel: vscode.OutputChannel, workspaceRootPath?: string): vscode.Disposable {
    let formatters = new Map<string, BaseFormatter>();
    let pythonSettings = settings;

    let yapfFormatter = new YapfFormatter(outputChannel, settings, workspaceRootPath);
    let autoPep8 = new AutoPep8Formatter(outputChannel, settings, workspaceRootPath);

    formatters.set(yapfFormatter.Id, yapfFormatter);
    formatters.set(autoPep8.Id, autoPep8);

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
            telemetryHelper.sendTelemetryEvent(telemetryContracts.IDE.Format, { Format_Provider: formatter.Id, Format_OnSave: "true" });
            e.waitUntil(formatter.formatDocument(document, null, null));
        }
    }, null, null);
}