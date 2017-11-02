'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import { SystemVariables } from './systemVariables';
import { EventEmitter } from 'events';
const untildify = require('untildify');

export const IS_WINDOWS = /^win/.test(process.platform);

export interface IPythonSettings {
    pythonPath: string;
    venvPath: string;
    jediPath: string;
    devOptions: string[];
    linting: ILintingSettings;
    formatting: IFormattingSettings;
    unitTest: IUnitTestSettings;
    autoComplete: IAutoCompeteSettings;
    terminal: ITerminalSettings;
    jupyter: JupyterSettings;
    sortImports: ISortImportSettings;
    workspaceSymbols: IWorkspaceSymbolSettings;
    envFile: string;
    disablePromptForFeatures: string[];
}
export interface ISortImportSettings {
    path: string;
    args: string[];
}

export interface IUnitTestSettings {
    promptToConfigure: boolean;
    debugPort: number;
    nosetestsEnabled: boolean;
    nosetestPath: string;
    nosetestArgs: string[];
    pyTestEnabled: boolean;
    pyTestPath: string;
    pyTestArgs: string[];
    unittestEnabled: boolean;
    unittestArgs: string[];
    outputWindow: string;
    cwd?: string;
}
export interface IPylintCategorySeverity {
    convention: vscode.DiagnosticSeverity;
    refactor: vscode.DiagnosticSeverity;
    warning: vscode.DiagnosticSeverity;
    error: vscode.DiagnosticSeverity;
    fatal: vscode.DiagnosticSeverity;
}
export interface IPep8CategorySeverity {
    W: vscode.DiagnosticSeverity;
    E: vscode.DiagnosticSeverity;
}
export interface Flake8CategorySeverity {
    F: vscode.DiagnosticSeverity;
    E: vscode.DiagnosticSeverity;
    W: vscode.DiagnosticSeverity;
}
export interface IMypyCategorySeverity {
    error: vscode.DiagnosticSeverity;
    note: vscode.DiagnosticSeverity;
}
export interface ILintingSettings {
    enabled: boolean;
    enabledWithoutWorkspace: boolean;
    ignorePatterns: string[];
    prospectorEnabled: boolean;
    prospectorArgs: string[];
    pylintEnabled: boolean;
    pylintArgs: string[];
    pep8Enabled: boolean;
    pep8Args: string[];
    pylamaEnabled: boolean;
    pylamaArgs: string[];
    flake8Enabled: boolean;
    flake8Args: string[];
    pydocstyleEnabled: boolean;
    pydocstyleArgs: string[];
    lintOnTextChange: boolean;
    lintOnSave: boolean;
    maxNumberOfProblems: number;
    pylintCategorySeverity: IPylintCategorySeverity;
    pep8CategorySeverity: IPep8CategorySeverity;
    flake8CategorySeverity: Flake8CategorySeverity;
    mypyCategorySeverity: IMypyCategorySeverity;
    prospectorPath: string;
    pylintPath: string;
    pep8Path: string;
    pylamaPath: string;
    flake8Path: string;
    pydocstylePath: string;
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
    formatOnSave: boolean;
    outputWindow: string;
}
export interface IAutoCompeteSettings {
    addBrackets: boolean;
    extraPaths: string[];
    preloadModules: string[];
}
export interface IWorkspaceSymbolSettings {
    enabled: boolean;
    tagFilePath: string;
    rebuildOnStart: boolean;
    rebuildOnFileSave: boolean;
    ctagsPath: string;
    exclusionPatterns: string[];
}
export interface ITerminalSettings {
    executeInFileDir: boolean;
    launchArgs: string[];
    executeWithPythonPathEnvVariable: string;
}
export interface JupyterSettings {
    appendResults: boolean;
    defaultKernel: string;
    startupCode: string[];
}

const IS_TEST_EXECUTION = process.env['PYTHON_DONJAYAMANNE_TEST'] === '1';

export class PythonSettings extends EventEmitter implements IPythonSettings {
    private static pythonSettings: PythonSettings = new PythonSettings();
    private disposables: vscode.Disposable[] = [];
    constructor() {
        super();
        if (PythonSettings.pythonSettings) {
            throw new Error('Singleton class, Use getInstance method');
        }
        this.disposables.push(vscode.workspace.onDidChangeConfiguration(() => {
            this.initializeSettings();
        }));

        this.initializeSettings();
    }
    public static getInstance(): PythonSettings {
        return PythonSettings.pythonSettings;
    }
    private initializeSettings() {
        const systemVariables: SystemVariables = new SystemVariables();
        const workspaceRoot = (IS_TEST_EXECUTION || typeof vscode.workspace.rootPath !== 'string') ? __dirname : vscode.workspace.rootPath;
        let pythonSettings = vscode.workspace.getConfiguration('python');
        this.pythonPath = systemVariables.resolveAny(pythonSettings.get<string>('pythonPath'))!;
        this.pythonPath = getAbsolutePath(this.pythonPath, IS_TEST_EXECUTION ? __dirname : workspaceRoot);
        this.venvPath = systemVariables.resolveAny(pythonSettings.get<string>('venvPath'))!;
        this.jediPath = systemVariables.resolveAny(pythonSettings.get<string>('jediPath'))!;
        if (typeof this.jediPath === 'string' && this.jediPath.length > 0) {
            this.jediPath = getAbsolutePath(systemVariables.resolveAny(this.jediPath), IS_TEST_EXECUTION ? __dirname : workspaceRoot);
        }
        else {
            this.jediPath = '';
        }
        this.envFile = systemVariables.resolveAny(pythonSettings.get<string>('envFile'))!;
        this.devOptions = systemVariables.resolveAny(pythonSettings.get<any[]>('devOptions'))!;
        this.devOptions = Array.isArray(this.devOptions) ? this.devOptions : [];
        let lintingSettings = systemVariables.resolveAny(pythonSettings.get<ILintingSettings>('linting'))!;
        this.disablePromptForFeatures = pythonSettings.get<string[]>('disablePromptForFeatures')!;
        this.disablePromptForFeatures = Array.isArray(this.disablePromptForFeatures) ? this.disablePromptForFeatures : [];
        if (this.linting) {
            Object.assign<ILintingSettings, ILintingSettings>(this.linting, lintingSettings);
        }
        else {
            this.linting = lintingSettings;
        }
        let sortImportSettings = systemVariables.resolveAny(pythonSettings.get<ISortImportSettings>('sortImports'))!;
        if (this.sortImports) {
            Object.assign<ISortImportSettings, ISortImportSettings>(this.sortImports, sortImportSettings);
        }
        else {
            this.sortImports = sortImportSettings;
        }
        // Support for travis
        this.sortImports = this.sortImports ? this.sortImports : { path: '', args: [] };
        // Support for travis
        this.linting = this.linting ? this.linting : {
            enabled: false,
            enabledWithoutWorkspace: false,
            ignorePatterns: [],
            flake8Args: [], flake8Enabled: false, flake8Path: 'flake',
            lintOnSave: false, lintOnTextChange: false, maxNumberOfProblems: 100,
            mypyArgs: [], mypyEnabled: false, mypyPath: 'mypy',
            outputWindow: 'python', pep8Args: [], pep8Enabled: false, pep8Path: 'pep8',
            pylamaArgs: [], pylamaEnabled: false, pylamaPath: 'pylama',
            prospectorArgs: [], prospectorEnabled: false, prospectorPath: 'prospector',
            pydocstyleArgs: [], pydocstyleEnabled: false, pydocstylePath: 'pydocstyle',
            pylintArgs: [], pylintEnabled: false, pylintPath: 'pylint',
            pylintCategorySeverity: {
                convention: vscode.DiagnosticSeverity.Hint,
                error: vscode.DiagnosticSeverity.Error,
                fatal: vscode.DiagnosticSeverity.Error,
                refactor: vscode.DiagnosticSeverity.Hint,
                warning: vscode.DiagnosticSeverity.Warning
            },
            pep8CategorySeverity: {
                E: vscode.DiagnosticSeverity.Error,
                W: vscode.DiagnosticSeverity.Warning
            },
            flake8CategorySeverity: {
                F: vscode.DiagnosticSeverity.Error,
                E: vscode.DiagnosticSeverity.Error,
                W: vscode.DiagnosticSeverity.Warning
            },
            mypyCategorySeverity: {
                error: vscode.DiagnosticSeverity.Error,
                note: vscode.DiagnosticSeverity.Hint
            }
        };
        this.linting.pylintPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylintPath), workspaceRoot);
        this.linting.flake8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.flake8Path), workspaceRoot);
        this.linting.pep8Path = getAbsolutePath(systemVariables.resolveAny(this.linting.pep8Path), workspaceRoot);
        this.linting.pylamaPath = getAbsolutePath(systemVariables.resolveAny(this.linting.pylamaPath), workspaceRoot);
        this.linting.prospectorPath = getAbsolutePath(systemVariables.resolveAny(this.linting.prospectorPath), workspaceRoot);
        this.linting.pydocstylePath = getAbsolutePath(systemVariables.resolveAny(this.linting.pydocstylePath), workspaceRoot);
        this.linting.mypyPath = getAbsolutePath(systemVariables.resolveAny(this.linting.mypyPath), workspaceRoot);

        let formattingSettings = systemVariables.resolveAny(pythonSettings.get<IFormattingSettings>('formatting'))!;
        if (this.formatting) {
            Object.assign<IFormattingSettings, IFormattingSettings>(this.formatting, formattingSettings);
        }
        else {
            this.formatting = formattingSettings;
        }
        // Support for travis
        this.formatting = this.formatting ? this.formatting : {
            autopep8Args: [], autopep8Path: 'autopep8',
            outputWindow: 'python',
            provider: 'autopep8',
            yapfArgs: [], yapfPath: 'yapf',
            formatOnSave: false
        };
        this.formatting.autopep8Path = getAbsolutePath(systemVariables.resolveAny(this.formatting.autopep8Path), workspaceRoot);
        this.formatting.yapfPath = getAbsolutePath(systemVariables.resolveAny(this.formatting.yapfPath), workspaceRoot);

        let autoCompleteSettings = systemVariables.resolveAny(pythonSettings.get<IAutoCompeteSettings>('autoComplete'))!;
        if (this.autoComplete) {
            Object.assign<IAutoCompeteSettings, IAutoCompeteSettings>(this.autoComplete, autoCompleteSettings);
        }
        else {
            this.autoComplete = autoCompleteSettings;
        }
        // Support for travis
        this.autoComplete = this.autoComplete ? this.autoComplete : {
            extraPaths: [],
            addBrackets: false,
            preloadModules: []
        };

        let workspaceSymbolsSettings = systemVariables.resolveAny(pythonSettings.get<IWorkspaceSymbolSettings>('workspaceSymbols'))!;
        if (this.workspaceSymbols) {
            Object.assign<IWorkspaceSymbolSettings, IWorkspaceSymbolSettings>(this.workspaceSymbols, workspaceSymbolsSettings);
        }
        else {
            this.workspaceSymbols = workspaceSymbolsSettings;
        }
        // Support for travis
        this.workspaceSymbols = this.workspaceSymbols ? this.workspaceSymbols : {
            ctagsPath: 'ctags',
            enabled: true,
            exclusionPatterns: [],
            rebuildOnFileSave: true,
            rebuildOnStart: true,
            tagFilePath: path.join(workspaceRoot, "tags")
        };
        this.workspaceSymbols.tagFilePath = getAbsolutePath(systemVariables.resolveAny(this.workspaceSymbols.tagFilePath), workspaceRoot);

        let unitTestSettings = systemVariables.resolveAny(pythonSettings.get<IUnitTestSettings>('unitTest'))!;
        if (this.unitTest) {
            Object.assign<IUnitTestSettings, IUnitTestSettings>(this.unitTest, unitTestSettings);
        }
        else {
            this.unitTest = unitTestSettings;
            if (IS_TEST_EXECUTION && !this.unitTest) {
                this.unitTest = {
                    nosetestArgs: [], pyTestArgs: [], unittestArgs: [],
                    promptToConfigure: true, debugPort: 3000,
                    nosetestsEnabled: false, pyTestEnabled: false, unittestEnabled: false,
                    nosetestPath: 'nosetests', pyTestPath: 'py.test', outputWindow: 'Python Test Log'
                } as IUnitTestSettings;
            }
        }

        // Support for travis
        this.unitTest = this.unitTest ? this.unitTest : {
            promptToConfigure: true,
            debugPort: 3000,
            nosetestArgs: [], nosetestPath: 'nosetest', nosetestsEnabled: false,
            outputWindow: 'python',
            pyTestArgs: [], pyTestEnabled: false, pyTestPath: 'pytest',
            unittestArgs: [], unittestEnabled: false
        };
        this.unitTest.pyTestPath = getAbsolutePath(systemVariables.resolveAny(this.unitTest.pyTestPath), workspaceRoot);
        this.unitTest.nosetestPath = getAbsolutePath(systemVariables.resolveAny(this.unitTest.nosetestPath), workspaceRoot);
        if (this.unitTest.cwd) {
            this.unitTest.cwd = getAbsolutePath(systemVariables.resolveAny(this.unitTest.cwd), workspaceRoot);
        }

        // Resolve any variables found in the test arguments
        this.unitTest.nosetestArgs = this.unitTest.nosetestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.pyTestArgs = this.unitTest.pyTestArgs.map(arg => systemVariables.resolveAny(arg));
        this.unitTest.unittestArgs = this.unitTest.unittestArgs.map(arg => systemVariables.resolveAny(arg));

        let terminalSettings = systemVariables.resolveAny(pythonSettings.get<ITerminalSettings>('terminal'))!;
        if (this.terminal) {
            Object.assign<ITerminalSettings, ITerminalSettings>(this.terminal, terminalSettings);
        }
        else {
            this.terminal = terminalSettings;
            if (IS_TEST_EXECUTION && !this.terminal) {
                this.terminal = {} as ITerminalSettings;
            }
        }
        // Support for travis
        this.terminal = this.terminal ? this.terminal : {
            executeInFileDir: true,
            launchArgs: [],
            executeWithPythonPathEnvVariable: ""
        };

        this.jupyter = pythonSettings.get<JupyterSettings>('jupyter')!;
        // Support for travis
        this.jupyter = this.jupyter ? this.jupyter : {
            appendResults: true, defaultKernel: '', startupCode: []
        };

        this.emit('change');
    }

    private _pythonPath: string;
    public get pythonPath(): string {
        return this._pythonPath;
    }
    public set pythonPath(value: string) {
        if (this._pythonPath === value) {
            return;
        }
        // Add support for specifying just the directory where the python executable will be located
        // E.g. virtual directory name
        try {
            this._pythonPath = getPythonExecutable(value);
        }
        catch (ex) {
            this._pythonPath = value;
        }
    }
    public jediPath: string;
    public envFile: string;
    public disablePromptForFeatures: string[];
    public venvPath: string;
    public devOptions: string[];
    public linting: ILintingSettings;
    public formatting: IFormattingSettings;
    public autoComplete: IAutoCompeteSettings;
    public unitTest: IUnitTestSettings;
    public terminal: ITerminalSettings;
    public jupyter: JupyterSettings;
    public sortImports: ISortImportSettings;
    public workspaceSymbols: IWorkspaceSymbolSettings;
}

function getAbsolutePath(pathToCheck: string, rootDir: string): string {
    pathToCheck = untildify(pathToCheck);
    if (IS_TEST_EXECUTION && !pathToCheck) { return rootDir; }
    if (pathToCheck.indexOf(path.sep) === -1) {
        return pathToCheck;
    }
    return path.isAbsolute(pathToCheck) ? pathToCheck : path.resolve(rootDir, pathToCheck);
}

function getPythonExecutable(pythonPath: string): string {
    pythonPath = untildify(pythonPath);

    // If only 'python'
    if (pythonPath === 'python' ||
        pythonPath.indexOf(path.sep) === -1 ||
        path.basename(pythonPath) === path.dirname(pythonPath)) {
        return pythonPath;
    }

    if (isValidPythonPath(pythonPath)) {
        return pythonPath;
    }
    // Keep python right on top, for backwards compatibility
    const KnownPythonExecutables = ['python', 'python4', 'python3.6', 'python3.5', 'python3', 'python2.7', 'python2'];

    for (let executableName of KnownPythonExecutables) {
        // Suffix with 'python' for linux and 'osx', and 'python.exe' for 'windows'
        if (IS_WINDOWS) {
            executableName = executableName + '.exe';
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'scripts', executableName))) {
                return path.join(pythonPath, 'scripts', executableName);
            }
        }
        else {
            if (isValidPythonPath(path.join(pythonPath, executableName))) {
                return path.join(pythonPath, executableName);
            }
            if (isValidPythonPath(path.join(pythonPath, 'bin', executableName))) {
                return path.join(pythonPath, 'bin', executableName);
            }
        }
    }

    return pythonPath;
}

function isValidPythonPath(pythonPath: string): boolean {
    try {
        let output = child_process.execFileSync(pythonPath, ['-c', 'print(1234)'], { encoding: 'utf8' });
        return output.startsWith('1234');
    }
    catch (ex) {
        return false;
    }
}
