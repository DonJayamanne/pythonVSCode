"use strict";

import * as vscode from "vscode";

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
    unittestEnabled: boolean;
    unittestArgs: string[];
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
export class PythonSettings implements IPythonSettings {
    private static pythonSettings: PythonSettings = new PythonSettings();
    constructor() {
        if (PythonSettings.pythonSettings) {
            throw new Error("Singleton class, Use getInstance method");
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
        let pythonSettings = vscode.workspace.getConfiguration("python");
        this.pythonPath = pythonSettings.get<string>("pythonPath");
        this.devOptions = pythonSettings.get<any[]>("devOptions");
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        let lintingSettings = pythonSettings.get<ILintingSettings>("linting");
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
        }

        let formattingSettings = pythonSettings.get<IFormattingSettings>("formatting");
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }

        let autoCompleteSettings = pythonSettings.get<IAutoCompeteSettings>("autoComplete");
        if (this.autoComplete) {
            Object.assign<IAutoCompeteSettings, IAutoCompeteSettings>(this.autoComplete, autoCompleteSettings);
        }
        else {
            this.autoComplete = autoCompleteSettings;
        }

        let unitTestSettings = pythonSettings.get<IUnitTestSettings>("unitTest");
        if (this.unitTest) {
            Object.assign<IUnitTestSettings, IUnitTestSettings>(this.unitTest, unitTestSettings);
        }
        else {
            this.unitTest = unitTestSettings;
        }

        replaceTokensInPaths(this);
    }

    public pythonPath: string;
    public devOptions: any[];
    public linting: ILintingSettings;
    public formatting: IFormattingSettings;
    public autoComplete: IAutoCompeteSettings;
    public unitTest: IUnitTestSettings;
}

function replaceTokensInPaths(settings: IPythonSettings) {
    if (!vscode.workspace || !vscode.workspace.rootPath) {
        return;
    }
    // In test environment (travic CI)
    if (typeof settings.pythonPath !== "string"){
        return;
    }

    let workspaceRoot = vscode.workspace.rootPath;
    settings.pythonPath = settings.pythonPath.replace("${workspaceRoot}", workspaceRoot);
    settings.formatting.autopep8Path = settings.formatting.autopep8Path.replace("${workspaceRoot}", workspaceRoot);
    settings.formatting.yapfPath = settings.formatting.yapfPath.replace("${workspaceRoot}", workspaceRoot);
    settings.linting.flake8Path = settings.linting.flake8Path.replace("${workspaceRoot}", workspaceRoot);
    settings.linting.pep8Path = settings.linting.pep8Path.replace("${workspaceRoot}", workspaceRoot);
    settings.linting.prospectorPath = settings.linting.prospectorPath.replace("${workspaceRoot}", workspaceRoot);
    settings.linting.pydocStylePath = settings.linting.pydocStylePath.replace("${workspaceRoot}", workspaceRoot);
    settings.linting.pylintPath = settings.linting.pylintPath.replace("${workspaceRoot}", workspaceRoot);
    settings.unitTest.nosetestPath = settings.unitTest.nosetestPath.replace("${workspaceRoot}", workspaceRoot);
    settings.unitTest.pyTestPath = settings.unitTest.pyTestPath.replace("${workspaceRoot}", workspaceRoot);
    settings.autoComplete.extraPaths.forEach((value, index) => {
        settings.autoComplete.extraPaths[index] = settings.autoComplete.extraPaths[index].replace("${workspaceRoot}", workspaceRoot);
    });
}