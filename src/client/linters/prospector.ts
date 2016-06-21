"use strict";

import * as path from "path";
import * as baseLinter from "./baseLinter";
import {OutputChannel, workspace, window} from "vscode";
import {execPythonFile} from "./../common/utils";

interface IProspectorResponse {
    messages: IProspectorMessage[];
}
interface IProspectorMessage {
    source: "string";
    message: "string";
    code: "string";
    location: IProspectorLocation;
}
interface IProspectorLocation {
    function: string;
    path: string;
    line: number;
    character: number;
    module: "beforeFormat";
}

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, workspaceRootPath: string) {
        super("prospector", outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.prospectorEnabled;
    }
    public runLinter(filePath: string, txtDocumentLines: string[]): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.prospectorEnabled) {
            return Promise.resolve([]);
        }

        let prospectorPath = this.pythonSettings.linting.prospectorPath;
        let prospectorExtraCommands = this.pythonSettings.linting.prospectorExtraCommands;
        let outputChannel = this.outputChannel;
        let linterId = this.Id;

        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            execPythonFile(prospectorPath, ["--absolute-paths", "--output-format=json", filePath], this.workspaceRootPath, false).then(data => {
                outputChannel.clear();
                let parsedData: IProspectorResponse;
                try {
                    parsedData = JSON.parse(data);
                }
                catch (ex) {
                    outputChannel.append(data);
                    return resolve([]);
                }
                let diagnostics: baseLinter.ILintMessage[] = [];
                parsedData.messages.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(msg => {

                    let sourceLine = txtDocumentLines[msg.location.line - 1];
                    let sourceStart = sourceLine.substring(msg.location.character);
                    let endCol = txtDocumentLines[msg.location.line - 1].length;

                    // try to get the first word from the starting position
                    let possibleProblemWords = sourceStart.match(/\w+/g);
                    let possibleWord: string;
                    if (possibleProblemWords != null && possibleProblemWords.length > 0 && sourceStart.startsWith(possibleProblemWords[0])) {
                        possibleWord = possibleProblemWords[0];
                    }

                    diagnostics.push({
                        code: msg.code,
                        message: msg.message,
                        column: msg.location.character,
                        line: msg.location.line,
                        possibleWord: possibleWord,
                        type: msg.code,
                        provider: `${this.Id} - ${msg.source}`
                    });
                });

                resolve(diagnostics);
            }).catch(error => {
                outputChannel.appendLine(`Linting with ${linterId} failed.If not installed please turn if off in settings.\n ${error} `);
                window.showInformationMessage(`Linting with ${linterId} failed.If not installed please turn if off in settings.View Python output for details.`);
            });
        });
    }
}
