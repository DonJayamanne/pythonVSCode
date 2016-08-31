'use strict';

import * as vscode from 'vscode';
import {SystemVariables} from './systemVariables';
import {EventEmitter} from 'events';
import * as path from 'path';

export interface IPythonSettings {
    pythonPath: string;
    devOptions: any[];
    linting: ILintingSettings;
    formatting: IFormattingSettings;
    unitTest: IUnitTestSettings;
    autoComplete: IAutoCompeteSettings;
}
export interface IUnitTestSettings {
    nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    pyTestEnabled: boolean;
    pyTestPath: string;
    pyTestArgs: string[];
    outputWindow: string;
}
export interface IPylintCategorySeverity {
    convention: vscode.DiagnosticSeverity;
    refactor: vscode.DiagnosticSeverity;
    warning: vscode.DiagnosticSeverity;
    error: vscode.DiagnosticSeverity;
    fatal: vscode.DiagnosticSeverity;
}
export interface ILintingSettings {
    enabled: boolean;
    prospectorEnabled: boolean;
    prospectorArgs: string[];
    pylintEnabled: boolean;
    pylintArgs: string[];
    pep8Enabled: boolean;
    pep8Args: string[];
    flake8Enabled: boolean;
    flake8Args: string[];
    pydocstyleEnabled: boolean;
    pydocstleArgs: string[];
    lintOnTextChange: boolean;
    lintOnSave: boolean;
    maxNumberOfProblems: number;
    pylintCategorySeverity: IPylintCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pep8Path: string;
    flake8Path: string;
    pydocStylePath: string;
    outputWindow: string;
}
export interface IFormattingSettings {
    provider: string;
    autopep8Path: string;
    autopep8Args: string[];
    yapfPath: string;
    yapfArgs: string[];
    formatOnSave: boolean;
    outputWindow: string;
}
export interface IAutoCompeteSettings {
    extraPaths: string[];
}
const systemVariables: SystemVariables = new SystemVariables();
export class PythonSettings extends EventEmitter implements IPythonSettings {
    private static pythonSettings: PythonSettings = new PythonSettings();
    constructor() {
        super();
        if (PythonSettings.pythonSettings) {
            throw new Error('Singleton class, Use getInstance method');
        }
        vscode.workspace.onDidChangeConfiguration(() => {
            this.initializeSettings();
        });

        this.initializeSettings();
    }
    public static getInstance(): PythonSettings {
        return PythonSettings.pythonSettings;
    }
    private initializeSettings() {
        let pythonSettings = vscode.workspace.getConfiguration('python');
        this.pythonPath = systemVariables.resolveAny(pythonSettings.get<string>('pythonPath'));
        this.pythonPath = getAbsolutePath(this.pythonPath, vscode.workspace.rootPath);
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'));
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        let lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'));
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
        }
        this.linting.pylintPath = getAbsolutePath(this.linting.pylintPath, vscode.workspace.rootPath);
        this.linting.flake8Path = getAbsolutePath(this.linting.flake8Path, vscode.workspace.rootPath);
        this.linting.pep8Path = getAbsolutePath(this.linting.pep8Path, vscode.workspace.rootPath);
        this.linting.prospectorPath = getAbsolutePath(this.linting.prospectorPath, vscode.workspace.rootPath);
        this.linting.pydocStylePath = getAbsolutePath(this.linting.pydocStylePath, vscode.workspace.rootPath);

        let formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'));
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }
        this.formatting.autopep8Path = getAbsolutePath(this.formatting.autopep8Path, vscode.workspace.rootPath);
        this.formatting.yapfPath = getAbsolutePath(this.formatting.yapfPath, vscode.workspace.rootPath);

        let autoCompleteSettings = systemVariables.resolveAny(pythonSettings.get<IAutoCompeteSettings>('autoComplete'));
        if (this.autoComplete) {
            Object.assign<IAutoCompeteSettings, IAutoCompeteSettings>(this.autoComplete, autoCompleteSettings);
        }
        else {
            this.autoComplete = autoCompleteSettings;
        }

        let unitTestSettings = systemVariables.resolveAny(pythonSettings.get<IUnitTestSettings>('unitTest'));
        if (this.unitTest) {
            Object.assign<IUnitTestSettings, IUnitTestSettings>(this.unitTest, unitTestSettings);
        }
        else {
            this.unitTest = unitTestSettings;
        }
        this.emit('change');
        this.unitTest.pyTestPath = getAbsolutePath(this.unitTest.pyTestPath, vscode.workspace.rootPath);        
        this.unitTest.nosetestPath = getAbsolutePath(this.unitTest.nosetestPath, vscode.workspace.rootPath);        
    }

    public pythonPath: string;
    public devOptions: any[];
    public linting: ILintingSettings;
    public formatting: IFormattingSettings;
    public autoComplete: IAutoCompeteSettings;
    public unitTest: IUnitTestSettings;
}

function getAbsolutePath(pathToCheck: string, rootDir: String): string {
    if (pathToCheck.indexOf(path.sep) === -1){
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}