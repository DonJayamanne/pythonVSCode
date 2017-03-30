'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { execPythonFile } from './../common/utils';
import { Product } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

interface IProspectorResponse {
    messages: IProspectorMessage[];
}
interface IProspectorMessage {
    source: string;
    message: string;
    code: string;
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
    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('prospector', Product.prospector, outputChannel, workspaceRootPath);
    }

    public isEnabled(): Boolean {
        return this.pythonSettings.linting.prospectorEnabled;
    }
    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.prospectorEnabled) {
            return Promise.resolve([]);
        }

        let prospectorPath = this.pythonSettings.linting.prospectorPath;
        let outputChannel = this.outputChannel;
        let prospectorArgs = Array.isArray(this.pythonSettings.linting.prospectorArgs) ? this.pythonSettings.linting.prospectorArgs : [];
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            execPythonFile(prospectorPath, prospectorArgs.concat(['--absolute-paths', '--output-format=json', document.uri.fsPath]), this.workspaceRootPath, false, null, cancellation).then(data => {
                let parsedData: IProspectorResponse;
                try {
                    parsedData = JSON.parse(data);
                }
                catch (ex) {
                    outputChannel.append('#'.repeat(10) + 'Linting Output - ' + this.Id + '#'.repeat(10) + '\n');
                    outputChannel.append(data);
                    return resolve([]);
                }
                let diagnostics: baseLinter.ILintMessage[] = [];
                parsedData.messages.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(msg => {

                    let lineNumber = msg.location.line === null || isNaN(msg.location.line) ? 1 : msg.location.line;
                    let sourceLine = document.lineAt(lineNumber - 1).text;
                    let sourceStart = sourceLine.substring(msg.location.character);

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
                        line: lineNumber,
                        possibleWord: possibleWord,
                        type: msg.code,
                        provider: `${this.Id} - ${msg.source}`
                    });
                });

                resolve(diagnostics);
            }).catch(error => {
                this.handleError(this.Id, prospectorPath, error);
                resolve([]);
            });
        });
    }
}
