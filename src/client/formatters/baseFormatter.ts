'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {execPythonFile} from './../common/utils';
import * as settings from './../common/configSettings';
import {getTextEditsFromPatch, getTempFileWithDocumentContents} from './../common/editor';

export abstract class BaseFormatter {
    constructor(public Id: string, protected outputChannel: vscode.OutputChannel, protected pythonSettings: settings.IPythonSettings, protected workspaceRootPath: string) {
    }

    public abstract formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]>;

    protected provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, command: string, args: string[]): Thenable<vscode.TextEdit[]> {
        this.outputChannel.clear();

        // autopep8 and yapf have the ability to read from the process input stream and return the formatted code out of the output stream
        // However they don't support returning the diff of the formatted text when reading data from the input stream
        // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension cpu, i.e. les responsive solution
        let tmpFileCreated = document.isDirty;
        let filePromise = tmpFileCreated ? getTempFileWithDocumentContents(document) : Promise.resolve(document.fileName);
        return filePromise.then(filePath => {
            if (token && token.isCancellationRequested) {
                return [filePath, ''];
            }
            return Promise.all<string>([Promise.resolve(filePath), execPythonFile(command, args.concat([filePath]), this.workspaceRootPath)]);
        }).then(data => {
            // Delete the temporary file created
            if (tmpFileCreated) {
                fs.unlink(data[0]);
            }
            if (token && token.isCancellationRequested) {
                return [];
            }
            return getTextEditsFromPatch(document.getText(), data[1]);
        }).catch(error => {
            this.handleError(this.Id, command, error);
            return [];
        });
    }

    protected handleError(expectedFileName: string, fileName: string, error: Error) {
        let customError = `Formatting with ${this.Id} failed.`;

        if (typeof (error) === 'object' && error !== null && ((<any>error).code === 'ENOENT' || (<any>error).code === 127)) {
            // Check if we have some custom arguments such as "pylint --load-plugins pylint_django"
            // Such settings are no longer supported
            let stuffAfterFileName = fileName.substring(fileName.toUpperCase().lastIndexOf(expectedFileName) + expectedFileName.length);

            // Ok if we have a space after the file name, this means we have some arguments defined and this isn't supported
            if (stuffAfterFileName.trim().indexOf(' ') > 0) {
                customError = `Formatting failed, custom arguments in the 'python.formatting.${this.Id}Path' is not supported.\n` +
                    `Custom arguments to the formatter can be defined in 'python.formatter.${this.Id}Args' setting of settings.json.\n` +
                    'For further details, please see https://github.com/DonJayamanne/pythonVSCode/wiki/Troubleshooting-Linting#2-linting-with-xxx-failed-';
            }
            else {
                customError += `\nYou could either install the '${this.Id}' formatter, turn it off or use another formatter.`;
            }
        }

        this.outputChannel.appendLine(`\n${customError}\n${error + ''}`);
    }
}
