'use strict';

import * as vscode from 'vscode';
import { PythonCompletionItemProvider } from './providers/completionProvider';
import { PythonHoverProvider } from './providers/hoverProvider';
import { PythonDefinitionProvider } from './providers/definitionProvider';
import { PythonReferenceProvider } from './providers/referenceProvider';
import { PythonRenameProvider } from './providers/renameProvider';
import { PythonFormattingEditProvider } from './providers/formatProvider';
import { ShebangCodeLensProvider } from './providers/shebangCodeLensProvider'
import * as sortImports from './sortImports';
import { LintProvider } from './providers/lintProvider';
import { PythonSymbolProvider } from './providers/symbolProvider';
import { PythonSignatureProvider } from './providers/signatureProvider';
import * as settings from './common/configSettings';
import * as telemetryHelper from './common/telemetry';
import * as telemetryContracts from './common/telemetryContracts';
import { activateSimplePythonRefactorProvider } from './providers/simpleRefactorProvider';
import { SetInterpreterProvider } from './providers/setInterpreterProvider';
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
import { getPathFromPythonCommand } from './common/utils';
import { JupyterProvider } from './jupyter/provider';
import { activateGoToObjectDefinitionProvider } from './providers/objectDefinitionProvider';
import { InterpreterManager } from './interpreter';
import { SimpleConfigurationProvider } from './debugger';

const PYTHON: vscode.DocumentFilter = { language: 'python' };
let unitTestOutChannel: vscode.OutputChannel;
let formatOutChannel: vscode.OutputChannel;
let lintingOutChannel: vscode.OutputChannel;
let jupMain: jup.Jupyter;
export async function activate(context: vscode.ExtensionContext) {
    const pythonSettings = settings.PythonSettings.getInstance();
    const pythonExt = new PythonExt();
    context.subscriptions.push(pythonExt);
    // telemetryHelper.sendTelemetryEvent(telemetryContracts.EVENT_LOAD, {
    //     CodeComplete_Has_ExtraPaths: pythonSettings.autoComplete.extraPaths.length > 0 ? 'true' : 'false',
    //     Format_Has_Custom_Python_Path: pythonSettings.pythonPath.length !== 'python'.length ? 'true' : 'false',
    //     Has_PySpark_Path: hasPySparkInCompletionPath ? 'true' : 'false'
    // });
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
    const interpreterManager = new InterpreterManager();
    await interpreterManager.autoSetInterpreter();
    context.subscriptions.push(interpreterManager);
    context.subscriptions.push(new SetInterpreterProvider(interpreterManager));
    context.subscriptions.push(...activateExecInTerminalProvider());
    context.subscriptions.push(activateUpdateSparkLibraryProvider());
    activateSimplePythonRefactorProvider(context, formatOutChannel);
    context.subscriptions.push(activateFormatOnSaveProvider(PYTHON, formatOutChannel));
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
                action: { indentAction: vscode.IndentAction.None, appendText: '# ' },
            },
            {
                beforeText: /^\s+(continue|break|return)\b.*$/,
                action: { indentAction: vscode.IndentAction.Outdent },
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
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(PYTHON, new ShebangCodeLensProvider()))

    const symbolProvider = new PythonSymbolProvider(context, jediProx);
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(PYTHON, symbolProvider));
    if (pythonSettings.devOptions.indexOf('DISABLE_SIGNATURE') === -1) {
        context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(PYTHON, new PythonSignatureProvider(context, jediProx), '(', ','));
    }
    if (pythonSettings.formatting.provider !== 'none') {
        const formatProvider = new PythonFormattingEditProvider(context, formatOutChannel);
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
    tests.activate(context, unitTestOutChannel, symbolProvider);

    context.subscriptions.push(new WorkspaceSymbols(lintingOutChannel));

    context.subscriptions.push(vscode.languages.registerOnTypeFormattingEditProvider(PYTHON, new BlockFormatProviders(), ':'));
    // In case we have CR LF
    const triggerCharacters: string[] = os.EOL.split('');
    triggerCharacters.shift();

    const hepProvider = new HelpProvider();
    context.subscriptions.push(hepProvider);

    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('python', new SimpleConfigurationProvider()));
}

class PythonExt implements vscode.Disposable {

    private isDjangoProject: ContextKey;

    constructor() {
        this.isDjangoProject = new ContextKey('python.isDjangoProject');
        this.ensureState();
    }
    public dispose() {
        this.isDjangoProject = null;
    }
    private ensureState(): void {
        // context: python.isDjangoProject
        if (typeof vscode.workspace.rootPath === 'string') {
            this.isDjangoProject.set(fs.existsSync(vscode.workspace.rootPath.concat("/manage.py")));
        }
        else {
            this.isDjangoProject.set(false);
        }
    }
}

class ContextKey {
    private lastValue: boolean;

    constructor(private name: string) {
    }

    public set(value: boolean): void {
        if (this.lastValue === value) {
            return;
        }
        this.lastValue = value;
        vscode.commands.executeCommand('setContext', this.name, this.lastValue);
    }
} 
