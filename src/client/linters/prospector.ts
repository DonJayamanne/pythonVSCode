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

    public getExtraLinterArgs(document: TextDocument): string[] {
        return ['--absolute-paths', '--output-format=json', document.uri.fsPath];
    }

    public runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        let [linterPath, linterArgs] = this.getLinterPathAndArgs(document);
        let outputChannel = this.outputChannel;
        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            execPythonFile(linterPath, linterArgs, this.workspaceRootPath, false, null, cancellation).then(data => {
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

                    diagnostics.push({
                        code: msg.code,
                        message: msg.message,
                        column: msg.location.character,
                        line: lineNumber,
                        type: msg.code,
                        provider: `${this.Id} - ${msg.source}`
                    });
                });

                resolve(diagnostics);
            }).catch(error => {
                this.handleError(this.Id, linterPath, error);
                resolve([]);
            });
        });
    }
}
