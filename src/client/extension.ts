'use strict';

import * as vscode from 'vscode';
import { PythonCompletionItemProvider } from './providers/completionProvider';
import { PythonHoverProvider } from './providers/hoverProvider';
import { PythonDefinitionProvider } from './providers/definitionProvider';
import { PythonReferenceProvider } from './providers/referenceProvider';
import { PythonRenameProvider } from './providers/renameProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import * as sortImports from './sortImports';
import { LintProvider } from './providers/lintProvider';
import { PythonSymbolProvider } from './providers/symbolProvider';
import { PythonSignatureProvider } from './providers/signatureProvider';
import * as settings from './common/configSettings';
import * as telemetryHelper from './common/telemetry';
import * as telemetryContracts from './common/telemetryContracts';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { activateSetInterpreterProvider } from './providers/setInterpreterProvider';
import { activateExecInTerminalProvider } from './providers/execInTerminalProvider';
import { Commands } from './common/constants';
import * as tests from './unittests/main';
import * as jup from './jupyter/main';
import { HelpProvider } from './helpProvider';
import { activateUpdateSparkLibraryProvider } from './providers/updateSparkLibraryProvider';
import { activateFormatOnSaveProvider } from './providers/formatOnSaveProvider';
import { WorkspaceSymbols } from './workspaceSymbols/main';
import { BlockFormatProviders } from './typeFormatters/blockFormatProvider';
import * as os from 'os';
import * as fs from 'fs';
import { activateSingleFileDebug } from './singleFileDebug';
import { getPathFromPythonCommand } from './common/utils';
import { JupyterProvider } from './jupyter/provider';
import { activateGoToObjectDefinitionProvider } from './providers/objectDefinitionProvider';

const PYTHON: vscode.DocumentFilter = { language: 'python', scheme: 'file' };
let unitTestOutChannel: vscode.OutputChannel;
let formatOutChannel: vscode.OutputChannel;
let lintingOutChannel: vscode.OutputChannel;
let jupMain: jup.Jupyter;
export function activate(context: vscode.ExtensionContext) {
    let pythonSettings = settings.PythonSettings.getInstance();
    let pythonExt = new PythonExt();
    const hasPySparkInCompletionPath = pythonSettings.autoComplete.extraPaths.some(p => p.toLowerCase().indexOf('spark') >= 0);
    telemetryHelper.sendTelemetryEvent(telemetryContracts.EVENT_LOAD, {
        CodeComplete_Has_ExtraPaths: pythonSettings.autoComplete.extraPaths.length > 0 ? 'true' : 'false',
        Format_Has_Custom_Python_Path: pythonSettings.pythonPath.length !== 'python'.length ? 'true' : 'false',
        Has_PySpark_Path: hasPySparkInCompletionPath ? 'true' : 'false'
    });
    lintingOutChannel = vscode.window.createOutputChannel(pythonSettings.linting.outputWindow);
    formatOutChannel = lintingOutChannel;
    if (pythonSettings.linting.outputWindow !== pythonSettings.formatting.outputWindow) {
        formatOutChannel = vscode.window.createOutputChannel(pythonSettings.formatting.outputWindow);
        formatOutChannel.clear();
    }
    if (pythonSettings.linting.outputWindow !== pythonSettings.unitTest.outputWindow) {
        unitTestOutChannel = vscode.window.createOutputChannel(pythonSettings.unitTest.outputWindow);
        unitTestOutChannel.clear();
    }

    sortImports.activate(context, formatOutChannel);
    context.subscriptions.push(activateSetInterpreterProvider());
    context.subscriptions.push(...activateExecInTerminalProvider());
    context.subscriptions.push(activateUpdateSparkLibraryProvider());
    activateSimplePythonRefactorProvider(context, formatOutChannel);
    context.subscriptions.push(activateFormatOnSaveProvider(PYTHON, settings.PythonSettings.getInstance(), formatOutChannel));
    context.subscriptions.push(activateGoToObjectDefinitionProvider(context));

    context.subscriptions.push(vscode.commands.registerCommand(Commands.Start_REPL, () => {
        getPathFromPythonCommand(["-c", "import sys;print(sys.executable)"]).catch(() => {
            return pythonSettings.pythonPath;
        }).then(pythonExecutablePath => {
            let term = vscode.window.createTerminal('Python', pythonExecutablePath);
            term.show();
            context.subscriptions.push(term);
        });
    }));

    // Enable indentAction
    vscode.languages.setLanguageConfiguration(PYTHON.language, {
        onEnterRules: [
            {
                beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\s*$/,
                action: { indentAction: vscode.IndentAction.Indent }
            },
            {
                beforeText: /^ *#.*$/,
                afterText: /.+$/,
                action: { indentAction: vscode.IndentAction.None, appendText: '# ' }
            }
        ]
    });

    context.subscriptions.push(vscode.languages.registerRenameProvider(PYTHON, new PythonRenameProvider(formatOutChannel)));
    const definitionProvider = new PythonDefinitionProvider(context);
    const jediProx = definitionProvider.JediProxy;
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(PYTHON, definitionProvider));
    context.subscriptions.push(vscode.languages.registerHoverProvider(PYTHON, new PythonHoverProvider(context, jediProx)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(PYTHON, new PythonReferenceProvider(context, jediProx)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(PYTHON, new PythonCompletionItemProvider(context, jediProx), '.'));

    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PYTHON, new PythonSymbolProvider(context, jediProx)));
    if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON, new PythonSignatureProvider(context, jediProx), '(', ','));
    }
    if (pythonSettings.formatting.provider !== 'none') {
        const formatProvider = new PythonFormattingEditProvider(context, formatOutChannel, pythonSettings);
        context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(PYTHON, formatProvider));
        context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider(PYTHON, formatProvider));
    }

    const jupyterExtInstalled = vscode.extensions.getExtension('donjayamanne.jupyter');
    let linterProvider = new LintProvider(context, lintingOutChannel, (a, b) => Promise.resolve(false));
    context.subscriptions.push();
    if (jupyterExtInstalled) {
        if (jupyterExtInstalled.isActive) {
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        }

        jupyterExtInstalled.activate().then(() => {
            jupyterExtInstalled.exports.registerLanguageProvider(PYTHON.language, new JupyterProvider());
            linterProvider.documentHasJupyterCodeCells = jupyterExtInstalled.exports.hasCodeCells;
        });
    }
    else {
        jupMain = new jup.Jupyter(lintingOutChannel);
        const documentHasJupyterCodeCells = jupMain.hasCodeCells.bind(jupMain);
        jupMain.activate();
        context.subscriptions.push(jupMain);
        linterProvider.documentHasJupyterCodeCells = documentHasJupyterCodeCells;
    }
    tests.activate(context, unitTestOutChannel);

    context.subscriptions.push(new WorkspaceSymbols(lintingOutChannel));

    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    // In case we have CR LF
    const triggerCharacters: string[] = os.EOL.split('');
    triggerCharacters.shift();

    const hepProvider = new HelpProvider();
    context.subscriptions.push(hepProvider);

    context.subscriptions.push(activateSingleFileDebug());

    context.subscriptions.push(vscode.commands.registerCommand('extension.pydev-debug.getProgramName', config => {
        return vscode.window.showInputBox({
            placeHolder: "Please enter the name of a markdown file in the workspace folder",
            value: "readme.md"
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.pydev-debug.provideInitialConfigurations', () => {
        return [].join('\n');
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
class PythonExt {

    private _isDjangoProject: ContextKey;

    constructor() {
        this._isDjangoProject = new ContextKey('python.isDjangoProject');
        this._ensureState();
    }

    private _ensureState(): void {
        // context: python.isDjangoProject
        if (typeof vscode.workspace.rootPath === 'string') {
            this._isDjangoProject.set(fs.existsSync(vscode.workspace.rootPath.concat("/manage.py")));
        }
        else {
            this._isDjangoProject.set(false);
        }
    }
}

class ContextKey {
    private _name: string;
    private _lastValue: boolean;

    constructor(name: string) {
        this._name = name;
    }

    public set(value: boolean): void {
        if (this._lastValue === value) {
            return;
        }
        this._lastValue = value;
        vscode.commands.executeCommand('setContext', this._name, this._lastValue);
    }
}
