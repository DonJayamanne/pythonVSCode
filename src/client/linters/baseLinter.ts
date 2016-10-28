'use strict';
import { execPythonFile } from './../common/utils';
import * as settings from './../common/configSettings';
import { OutputChannel } from 'vscode';
import { isNotInstalledError } from '../common/helpers';
import { Installer, Product, disableLinter } from '../common/installer';
import * as vscode from 'vscode';

let NamedRegexp = null;
const REGEX = '(?<line>\\d+),(?<column>\\d+),(?<type>\\w+),(?<code>\\w\\d+):(?<message>.*)\\r?(\\n|$)';

export interface IRegexGroup {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
}

export interface ILintMessage {
    line: number;
    column: number;
    code: string;
    message: string;
    type: string;
    possibleWord?: string;
    severity?: LintMessageSeverity;
    provider: string;
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

    let compiledRegexp = NamedRegexp(regex, 'g');
    let rawMatch = compiledRegexp.exec(data);
    if (rawMatch !== null) {
        return <IRegexGroup>rawMatch.groups();
    }

    return null;
}

export abstract class BaseLinter {
    public Id: string;
    private installer: Installer;
    protected pythonSettings: settings.IPythonSettings;
    constructor(id: string, private product: Product, protected outputChannel: OutputChannel, protected workspaceRootPath: string) {
        this.Id = id;
        this.installer = new Installer();
        this.pythonSettings = settings.PythonSettings.getInstance();
    }
    public abstract isEnabled(): Boolean;
    public abstract runLinter(filePath: string, txtDocumentLines: string[]): Promise<ILintMessage[]>;

    protected run(command: string, args: string[], filePath: string, txtDocumentLines: string[], cwd: string, regEx: string = REGEX): Promise<ILintMessage[]> {
        let outputChannel = this.outputChannel;

        return new Promise<ILintMessage[]>((resolve, reject) => {
            execPythonFile(command, args, cwd, true).then(data => {
                outputChannel.append('#'.repeat(10) + 'Linting Output - ' + this.Id + '#'.repeat(10) + '\n');
                outputChannel.append(data);
                let outputLines = data.split(/\r?\n/g);
                let diagnostics: ILintMessage[] = [];
                outputLines.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(line => {
                    let match = matchNamedRegEx(line, regEx);
                    if (match == null) {
                        return;
                    }

                    try {
                        match.line = Number(<any>match.line);
                        match.column = Number(<any>match.column);

                        let possibleWord: string;
                        if (!isNaN(match.column)) {
                            let sourceLine = txtDocumentLines[match.line - 1];
                            let sourceStart = sourceLine.substring(match.column - 1);

                            // try to get the first word from the startig position
                            let possibleProblemWords = sourceStart.match(/\w+/g);
                            if (possibleProblemWords != null && possibleProblemWords.length > 0 && sourceStart.startsWith(possibleProblemWords[0])) {
                                possibleWord = possibleProblemWords[0];
                            }
                        }

                        diagnostics.push({
                            code: match.code,
                            message: match.message,
                            column: isNaN(match.column) || match.column === 0 ? 0 : match.column - 1,
                            line: match.line,
                            possibleWord: possibleWord,
                            type: match.type,
                            provider: this.Id
                        });
                    }
                    catch (ex) {
                        // Hmm, need to handle this later
                        // TODO:
                    }
                });

                resolve(diagnostics);
            }).catch(error => {
                this.handleError(this.Id, command, error);
                resolve([]);
            });
        });
    }

    protected handleError(expectedFileName: string, fileName: string, error: Error) {
        let customError = `Linting with ${this.Id} failed.`;

        if (isNotInstalledError(error)) {
            // Check if we have some custom arguments such as "pylint --load-plugins pylint_django"
            // Such settings are no longer supported
            let stuffAfterFileName = fileName.substring(fileName.toUpperCase().lastIndexOf(expectedFileName) + expectedFileName.length);

            // Ok if we have a space after the file name, this means we have some arguments defined and this isn't supported
            if (stuffAfterFileName.trim().indexOf(' ') > 0) {
                customError = `Linting failed, custom arguments in the 'python.linting.${this.Id}Path' is not supported.\n` +
                    `Custom arguments to the linters can be defined in 'python.linting.${this.Id}Args' setting of settings.json.\n` +
                    'For further details, please see https://github.com/DonJayamanne/pythonVSCode/wiki/Troubleshooting-Linting#2-linting-with-xxx-failed-';
                vscode.window.showErrorMessage(`Unsupported configuration for '${this.Id}'`, 'View Errors').then(item => {
                    if (item === 'View Errors') {
                        this.outputChannel.show();
                    }
                });
            }
            else {
                customError += `\nYou could either install the '${this.Id}' linter or turn it off in setings.json via "python.linting.${this.Id}Enabled = false".`;
                this.installer.promptToInstall(this.product);
            }
        }
        else {
            vscode.window.showErrorMessage(`There was an error in running the linter '${this.Id}'`, 'Disable linter', 'View Errors').then(item => {
                switch (item) {
                    case 'Disable linter': {
                        disableLinter(this.product);
                        break;
                    }
                    case 'View Errors': {
                        this.outputChannel.show();
                        break;
                    }
                }
            });
        }
        this.outputChannel.appendLine(`\n${customError}\n${error + ''}`);
    }
}
