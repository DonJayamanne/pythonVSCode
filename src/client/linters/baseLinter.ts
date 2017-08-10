'use strict';
import { execPythonFile } from './../common/utils';
import * as settings from './../common/configSettings';
import { OutputChannel } from 'vscode';
import { Installer, Product, ProductExecutableAndArgs } from '../common/installer';
import * as vscode from 'vscode';
import { ErrorHandler } from './errorHandlers/main';

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
    protected pythonSettings: settings.IPythonSettings;
    private _workspaceRootPath: string;
    protected _columnOffset = 0;
    private _errorHandler: ErrorHandler;
    protected get workspaceRootPath(): string {
        return typeof this._workspaceRootPath === 'string' ? this._workspaceRootPath : vscode.workspace.rootPath;
    }
    constructor(id: string, public product: Product, protected outputChannel: OutputChannel, workspaceRootPath: string) {
        this.Id = id;
        this._workspaceRootPath = workspaceRootPath;
        this.pythonSettings = settings.PythonSettings.getInstance();
        this._errorHandler = new ErrorHandler(this.Id, product, new Installer(), this.outputChannel);
    }
    public abstract getExtraLinterArgs(document: vscode.TextDocument): string[];

    public isEnabled(): Boolean {
        return this.pythonSettings.linting[`${this.Id}Enabled`];
    }

    public getLinterPathAndArgs(document: vscode.TextDocument): [string, string[]] {
        let linterSettings = this.pythonSettings.linting;
        let linterPath:string = linterSettings[`${this.Id}Path`];
        let linterArgs:string[] = Array.isArray(linterSettings[`${this.Id}Args`]) ? linterSettings[`${this.Id}Args`] : [];

        if (linterArgs.length === 0 && ProductExecutableAndArgs.has(Product[this.Id]) && linterPath === this.Id) {
            linterPath = ProductExecutableAndArgs.get(Product[this.Id]).executable;
            linterArgs = ProductExecutableAndArgs.get(Product[this.Id]).args;
        }

        linterArgs = linterArgs.concat(this.getExtraLinterArgs(document));
        return [linterPath, linterArgs];
    }

    public runLinter(document: vscode.TextDocument, cancellation: vscode.CancellationToken): Promise<ILintMessage[]> {
        let [linterPath, linterArgs] = this.getLinterPathAndArgs(document);
        return new Promise<ILintMessage[]>((resolve, reject) => {
            this.run(linterPath, linterArgs, document, this.workspaceRootPath, cancellation).then(messages => {
                messages.forEach(msg => {
                    msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting[`${this.Id}CategorySeverity`]);
                    msg.code = msg.type;
                });

                resolve(messages);
            }, reject);
        });
    }


    protected parseMessagesSeverity(error: string, categorySeverity: any): LintMessageSeverity {
        if (categorySeverity[error]) {
            let severityName = categorySeverity[error];
            switch (severityName) {
                case 'Error':
                    return LintMessageSeverity.Error;
                case 'Hint':
                    return LintMessageSeverity.Hint;
                case 'Information':
                    return LintMessageSeverity.Information;
                case 'Warning':
                    return LintMessageSeverity.Warning;
                default: {
                    if (LintMessageSeverity[severityName]) {
                        return <LintMessageSeverity><any>LintMessageSeverity[severityName];
                    }
                }
            }
        }

        return LintMessageSeverity.Information;
    }

    private parseLine(line: string, regEx: string) {
        let match = matchNamedRegEx(line, regEx);
        if (!match) {
            return;
        }

        match.line = Number(<any>match.line);
        match.column = Number(<any>match.column);

        return {
            code: match.code,
            message: match.message,
            column: isNaN(match.column) || match.column === 0 ? 0 : match.column - this._columnOffset,
            line: match.line,
            type: match.type,
            provider: this.Id
        };
    }
    private parseLines(outputLines: string[], regEx: string) {
        let diagnostics: ILintMessage[] = [];
        outputLines.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(line => {
            try {
                let msg = this.parseLine(line, regEx);
                if (msg) {
                    diagnostics.push(msg);
                }
            }
            catch (ex) {
                // Hmm, need to handle this later
                // TODO:
            }
        });
        return diagnostics;
    }
    private displayLinterResultHeader(data: string) {
        this.outputChannel.append('#'.repeat(10) + 'Linting Output - ' + this.Id + '#'.repeat(10) + '\n');
        this.outputChannel.append(data);
    }
    protected run(command: string, args: string[], document: vscode.TextDocument, cwd: string, cancellation: vscode.CancellationToken, regEx: string = REGEX): Promise<ILintMessage[]> {
        return execPythonFile(command, args, cwd, true, null, cancellation).then(data => {
            if (!data) {
                data = '';
            }
            this.displayLinterResultHeader(data);
            let outputLines = data.split(/\r?\n/g);
            return this.parseLines(outputLines, regEx);
        }).catch(error => {
            this.handleError(this.Id, command, error);
            return [];
        });
    }

    protected handleError(expectedFileName: string, fileName: string, error: Error) {
        this._errorHandler.handleError(expectedFileName, fileName, error);
    }
}
