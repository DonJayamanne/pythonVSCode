'use strict';
import * as child_process from 'child_process';
import * as path from 'path';
import { exec } from 'child_process';
import {execPythonFile} from './../common/utils';
import * as settings from './../common/configSettings';
import {OutputChannel, window} from 'vscode';

var NamedRegexp = null;
const REGEX = '(?<line>\\d+),(?<column>\\d+),(?<type>\\w+),(?<code>\\w\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
    line: number
    column: number
    code: string
    message: string
    type: string
}

export interface ILintMessage {
    line: number
    column: number
    code: string
    message: string
    type: string
    possibleWord?: string
    severity?: LintMessageSeverity
    provider: string
}
export enum LintMessageSeverity {
    Hint,
    Error,
    Warning,
    Information
}

export function matchNamedRegEx(data, regex): IRegexGroup {
    if (NamedRegexp === null) {
        NamedRegexp = require('named-js-regexp');
    }

    var compiledRegexp = NamedRegexp(regex, "g");
    var rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups()
    }

    return null;
}

export abstract class BaseLinter {
    public Id: string;
    protected pythonSettings: settings.IPythonSettings;
    constructor(id: string, protected outputChannel: OutputChannel, protected workspaceRootPath: string) {
        this.Id = id;
        this.pythonSettings = settings.PythonSettings.getInstance();
    }
    public abstract isEnabled(): Boolean;
    public abstract runLinter(filePath: string, txtDocumentLines: string[]): Promise<ILintMessage[]>;

    protected run(command: string, args: string[], filePath: string, txtDocumentLines: string[], cwd: string, regEx: string = REGEX): Promise<ILintMessage[]> {
        var outputChannel = this.outputChannel;
        var linterId = this.Id;

        return new Promise<ILintMessage[]>((resolve, reject) => {
            execPythonFile(command, args, cwd, true).then(data => {
                outputChannel.append("#".repeat(10) + "Linting Output - " + this.Id + "#".repeat(10));
                outputChannel.append(data);
                var outputLines = data.split(/\r?\n/g);
                var diagnostics: ILintMessage[] = [];
                outputLines.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(line => {
                    var match = matchNamedRegEx(line, regEx);
                    if (match == null) {
                        return;
                    }

                    try {
                        match.line = Number(<any>match.line);
                        match.column = Number(<any>match.column);

                        var sourceLine = txtDocumentLines[match.line - 1];
                        var sourceStart = sourceLine.substring(match.column - 1);
                        var endCol = txtDocumentLines[match.line - 1].length;

                        //try to get the first word from the startig position
                        var possibleProblemWords = sourceStart.match(/\w+/g);
                        var possibleWord: string;
                        if (possibleProblemWords != null && possibleProblemWords.length > 0 && sourceStart.startsWith(possibleProblemWords[0])) {
                            possibleWord = possibleProblemWords[0];
                        }

                        diagnostics.push({
                            code: match.code,
                            message: match.message,
                            column: match.column,
                            line: match.line,
                            possibleWord: possibleWord,
                            type: match.type,
                            provider: this.Id
                        });
                    }
                    catch (ex) {
                        //Hmm, need to handle this later
                        //TODO:
                        var y = "";
                    }
                });

                resolve(diagnostics);
            }).catch(error => {
                this.handleError(this.Id, command, error);
                return [];
            });
        });
    }

    protected handleError(expectedFileName: string, fileName: string, error: Error) {
        let customError = `Linting with ${this.Id} failed. Please install the linter or turn it off.`;

        if (typeof (error) === "object" && error !== null && ((<any>error).code === "ENOENT" || (<any>error).code === 127)) {
            // Check if we have some custom arguments such as "pylint --load-plugins pylint_django"
            // Such settings are no longer supported
            let stuffAfterFileName = fileName.substring(fileName.toUpperCase().lastIndexOf(expectedFileName) + expectedFileName.length);

            // Ok if we have a space after the file name, this means we have some arguments defined and this isn't supported
            if (stuffAfterFileName.trim().indexOf(" ") > 0) {
                customError = `Linting failed, custom arguments in the 'python.linting.${this.Id}Path' is not supported.\n` +
                    `Custom arguments to the linters can be defined in 'python.linting.${this.Id}Args' setting of settings.json.\n` +
                    "For further details, please see https://github.com/DonJayamanne/pythonVSCode/wiki/Troubleshooting-Linting#2-linting-with-xxx-failed-";
            }
        }

        this.outputChannel.appendLine(`${customError}\n${error + ""}`);
        window.showInformationMessage(`${customError}. View Python output for details.`);
    }
}
