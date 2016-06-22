'use strict';

import * as path from 'path';
import * as baseLinter from './baseLinter';
import {ILintMessage} from './baseLinter';
import {OutputChannel, window} from 'vscode';
import { exec } from 'child_process';
import {execPythonFile} from './../common/utils';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath: string) {
        super("pydocstyle", outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.pydocstyleEnabled;
    }
    public runLinter(filePath: string, txtDocumentLines: string[]): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pydocstyleEnabled) {
            return Promise.resolve([]);
        }

        var pydocStylePath = this.pythonSettings.linting.pydocStylePath;
        let pydocstyleArgs = Array.isArray(this.pythonSettings.linting.pydocstleArgs) ? this.pythonSettings.linting.pydocstleArgs : [];
        return new Promise<baseLinter.ILintMessage[]>(resolve => {
            this.run(pydocStylePath, pydocstyleArgs.concat([filePath]), filePath, txtDocumentLines).then(messages => {
                //All messages in pep8 are treated as warnings for now
                messages.forEach(msg => {
                    msg.severity = baseLinter.LintMessageSeverity.Information;
                });

                resolve(messages);
            });
        });
    }

    protected run(commandLine: string, args: string[], filePath: string, txtDocumentLines: string[]): Promise<ILintMessage[]> {
        var outputChannel = this.outputChannel;
        var linterId = this.Id;

        return new Promise<ILintMessage[]>((resolve, reject) => {
            var fileDir = path.dirname(filePath);
            execPythonFile(commandLine, args, this.workspaceRootPath, true).then(data => {
                outputChannel.clear();
                outputChannel.append(data);
                var outputLines = data.split(/\r?\n/g);
                var diagnostics: ILintMessage[] = [];
                var baseFileName = path.basename(filePath);

                // Remember, the first line of the response contains the file name and line number, the next line contains the error message
                // So we have two lines per message, hence we need to take lines in pairs
                var maxLines = this.pythonSettings.linting.maxNumberOfProblems * 2;
                // First line is almost always empty
                let oldOutputLines = outputLines.filter(line => line.length > 0);
                outputLines = [];
                for (let counter = 0; counter < oldOutputLines.length / 2; counter++) {
                    outputLines.push(oldOutputLines[2 * counter] + oldOutputLines[(2 * counter) + 1]);
                }
                outputLines = outputLines.filter((value, index) => index < maxLines && value.indexOf(":") >= 0).map(line => line.substring(line.indexOf(":") + 1).trim());

                // Iterate through the lines (skipping the messages)
                // So, just iterate the response in pairs
                outputLines.forEach(line => {
                    try {
                        if (line.trim().length === 0) {
                            return;
                        }
                        let lineNumber = parseInt(line.substring(0, line.indexOf(" ")));
                        let part = line.substring(line.indexOf(":") + 1).trim();
                        let code = part.substring(0, part.indexOf(":")).trim();
                        let message = part.substring(part.indexOf(":") + 1).trim();

                        let sourceLine = txtDocumentLines[lineNumber - 1];
                        let trmmedSourceLine = sourceLine.trim();
                        let sourceStart = sourceLine.indexOf(trmmedSourceLine);
                        let endCol = sourceStart + trmmedSourceLine.length;

                        diagnostics.push({
                            code: code,
                            message: message,
                            column: sourceStart,
                            line: lineNumber,
                            type: "",
                            provider: this.Id
                        });
                    }
                    catch (ex) {
                        //Hmm, need to handle this later
                        var y = "";
                    }
                });
                resolve(diagnostics);
            }, error => {
                outputChannel.appendLine(`Linting with ${linterId} failed. If not installed please turn if off in settings.\n ${error}`);
                window.showInformationMessage(`Linting with ${linterId} failed. If not installed please turn if off in settings. View Python output for details.`);
            });
        });
    }
}
