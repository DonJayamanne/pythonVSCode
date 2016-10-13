'use strict';

import * as vscode from 'vscode';
import { SystemVariables } from './systemVariables';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface IPythonSettings {
    pythonPath: string;
    devOptions: any[];
    linting: ILintingSettings;
    formatting: IFormattingSettings;
    unitTest: IUnitTestSettings;
    autoComplete: IAutoCompeteSettings;
    terminal: ITerminalSettings;
    jupyter: JupyterSettings;
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
    mypyEnabled: boolean;
    mypyArgs: string[];
    mypyPath: string;
}
export interface IFormattingSettings {
    provider: string;
    autopep8Path: string;
    autopep8Args: string[];
    yapfPath: string;
    yapfArgs: string[];
    outputWindow: string;
}
export interface IAutoCompeteSettings {
    extraPaths: string[];
}
export interface ITerminalSettings {
    executeInFileDir: boolean;
    launchArgs: string[];
}
export interface JupyterSettings {
    appendResults: boolean;
    defaultKernel: string;
    startupCode: string[];
}

const IS_TEST_EXECUTION = process.env['PYTHON_DONJAYAMANNE_TEST'] === '1';

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
        const workspaceRoot = IS_TEST_EXECUTION ? __dirname : vscode.workspace.rootPath;
        let pythonSettings = vscode.workspace.getConfiguration('python');
        this.pythonPath = systemVariables.resolveAny(pythonSettings.get<string>('pythonPath'));
        this.pythonPath = getAbsolutePath(this.pythonPath, IS_TEST_EXECUTION ? __dirname : workspaceRoot);
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'));
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        let lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'));
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
            if (IS_TEST_EXECUTION && !this.linting) {
                this.linting = {} as ILintingSettings;
            }
        }
        this.linting.pylintPath = getAbsolutePath(this.linting.pylintPath, workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(this.linting.flake8Path, workspaceRoot);
        this.linting.pep8Path = getAbsolutePath(this.linting.pep8Path, workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(this.linting.prospectorPath, workspaceRoot);
        this.linting.pydocStylePath = getAbsolutePath(this.linting.pydocStylePath, workspaceRoot);

        let formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'));
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }
        this.formatting.autopep8Path = getAbsolutePath(this.formatting.autopep8Path, workspaceRoot);
        this.formatting.yapfPath = getAbsolutePath(this.formatting.yapfPath, workspaceRoot);

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
            if (IS_TEST_EXECUTION && !this.unitTest) {
                this.unitTest = { nosetestArgs: [], pyTestArgs: [], unittestArgs: [] } as IUnitTestSettings;
            }
        }
        this.emit('change');
        this.unitTest.pyTestPath = getAbsolutePath(this.unitTest.pyTestPath, workspaceRoot);
        this.unitTest.nosetestPath = getAbsolutePath(this.unitTest.nosetestPath, workspaceRoot);

        // Resolve any variables found in the test arguments
        this.unitTest.nosetestArgs = this.unitTest.nosetestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.pyTestArgs = this.unitTest.pyTestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.unittestArgs = this.unitTest.unittestArgs.map(arg => systemVariables.resolveAny(arg));

        let terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'));
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        }
        else {
            this.terminal = terminalSettings;
            if (IS_TEST_EXECUTION && !this.terminal) {
                this.terminal = {} as ITerminalSettings;
            }
        }
        this.jupyter = pythonSettings.get<JupyterSettings>('jupyter');
    }

    public pythonPath: string;
    public devOptions: any[];
    public linting: ILintingSettings;
    public formatting: IFormattingSettings;
    public autoComplete: IAutoCompeteSettings;
    public unitTest: IUnitTestSettings;
    public terminal: ITerminalSettings;
    public jupyter: JupyterSettings;
}

function getAbsolutePath(pathToCheck: string, rootDir: string): string {
    if (IS_TEST_EXECUTION && !pathToCheck) { return rootDir; }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}