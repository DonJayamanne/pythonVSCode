'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as linter from '../linters/baseLinter';
import * as prospector from './../linters/prospector';
import * as pylint from './../linters/pylint';
import * as pep8 from './../linters/pep8Linter';
import * as pylama from './../linters/pylama';
import * as flake8 from './../linters/flake8';
import * as pydocstyle from './../linters/pydocstyle';
import * as mypy from './../linters/mypy';
import { PythonSettings } from '../common/configSettings';
import * as fs from 'fs';
import { LinterErrors } from '../common/constants';
const Minimatch = require("minimatch").Minimatch;

const uriSchemesToIgnore = ['git', 'showModifications'];
const lintSeverityToVSSeverity = new Map<linter.LintMessageSeverity, vscode.DiagnosticSeverity>();
lintSeverityToVSSeverity.set(linter.LintMessageSeverity.Error, vscode.DiagnosticSeverity.Error);
lintSeverityToVSSeverity.set(linter.LintMessageSeverity.Hint, vscode.DiagnosticSeverity.Hint);
lintSeverityToVSSeverity.set(linter.LintMessageSeverity.Information, vscode.DiagnosticSeverity.Information);
lintSeverityToVSSeverity.set(linter.LintMessageSeverity.Warning, vscode.DiagnosticSeverity.Warning);

function createDiagnostics(message: linter.ILintMessage, document: vscode.TextDocument): vscode.Diagnostic {
    let position = new vscode.Position(message.line - 1, message.column);
    let range = new vscode.Range(position, position);

    let severity = lintSeverityToVSSeverity.get(message.severity);
    let diagnostic = new vscode.Diagnostic(range, message.code + ':' + message.message, severity);
    diagnostic.code = message.code;
    diagnostic.source = message.provider;
    return diagnostic;
}

interface DocumentHasJupyterCodeCells {
    (doc: vscode.TextDocument, token: vscode.CancellationToken): Promise<Boolean>;
}
export class LintProvider extends vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private linters: linter.BaseLinter[] = [];
    private pendingLintings = new Map<string, vscode.CancellationTokenSource>();
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[];
    public constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel,
        public documentHasJupyterCodeCells: DocumentHasJupyterCodeCells) {
        super(() => { });
        this.outputChannel = outputChannel;
        this.context = context;
        this.disposables = [];
        this.initialize();
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private isDocumentOpen(uri: vscode.Uri): boolean {
        return vscode.window.visibleTextEditors.some(editor => editor.document && editor.document.uri.fsPath === uri.fsPath);
    }

    private initialize() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('python');

        this.linters.push(new prospector.Linter(this.outputChannel));
        this.linters.push(new pylint.Linter(this.outputChannel));
        this.linters.push(new pep8.Linter(this.outputChannel));
        this.linters.push(new pylama.Linter(this.outputChannel));
        this.linters.push(new flake8.Linter(this.outputChannel));
        this.linters.push(new pydocstyle.Linter(this.outputChannel));
        this.linters.push(new mypy.Linter(this.outputChannel));

        let disposable = vscode.workspace.onDidSaveTextDocument((e) => {
            const settings = PythonSettings.getInstance(e.uri);
            if (e.languageId !== 'python' || !settings.linting.enabled || !settings.linting.lintOnSave) {
                return;
            }
            this.lintDocument(e, 100);
        });
        this.context.subscriptions.push(disposable);

        vscode.workspace.onDidOpenTextDocument((e) => {
            const settings = PythonSettings.getInstance(e.uri);
            if (e.languageId !== 'python' || !settings.linting.enabled) {
                return;
            }
            // Exclude files opened by vscode when showing a diff view
            if (uriSchemesToIgnore.indexOf(e.uri.scheme) >= 0) {
                return;
            }
            if (!e.uri.path || (path.basename(e.uri.path) === e.uri.path && !fs.existsSync(e.uri.path))) {
                return;
            }
            this.lintDocument(e, 100);
        }, this.context.subscriptions);

        disposable = vscode.workspace.onDidCloseTextDocument(textDocument => {
            if (!textDocument || !textDocument.fileName || !textDocument.uri) {
                return;
            }

            // Check if this document is still open as a duplicate editor
            if (!this.isDocumentOpen(textDocument.uri) && this.diagnosticCollection.has(textDocument.uri)) {
                this.diagnosticCollection.set(textDocument.uri, []);
            }
        });
        this.context.subscriptions.push(disposable);
    }

    private lastTimeout: number;
    private lintDocument(document: vscode.TextDocument, delay: number): void {
        // Since this is a hack, lets wait for 2 seconds before linting
        // Give user to continue typing before we waste CPU time
        if (this.lastTimeout) {
            clearTimeout(this.lastTimeout);
            this.lastTimeout = 0;
        }

        this.lastTimeout = setTimeout(() => {
            this.onLintDocument(document);
        }, delay);
    }

    private onLintDocument(document: vscode.TextDocument): void {
        // Check if we need to lint this document
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const workspaceRootPath = (workspaceFolder && typeof workspaceFolder.uri.fsPath === 'string') ? workspaceFolder.uri.fsPath : undefined;
        const relativeFileName = typeof workspaceRootPath === 'string' ? path.relative(workspaceRootPath, document.fileName) : document.fileName;
        const settings = PythonSettings.getInstance(document.uri);
        const ignoreMinmatches = settings.linting.ignorePatterns.map(pattern => {
            return new Minimatch(pattern);
        });

        if (ignoreMinmatches.some(matcher => matcher.match(document.fileName) || matcher.match(relativeFileName))) {
            return;
        }
        if (this.pendingLintings.has(document.uri.fsPath)) {
            this.pendingLintings.get(document.uri.fsPath).cancel();
            this.pendingLintings.delete(document.uri.fsPath);
        }

        let cancelToken = new vscode.CancellationTokenSource();
        cancelToken.token.onCancellationRequested(() => {
            if (this.pendingLintings.has(document.uri.fsPath)) {
                this.pendingLintings.delete(document.uri.fsPath);
            }
        });

        this.pendingLintings.set(document.uri.fsPath, cancelToken);
        this.outputChannel.clear();
        let promises: Promise<linter.ILintMessage[]>[] = this.linters.map(linter => {
            if (typeof workspaceRootPath !== 'string' && !settings.linting.enabledWithoutWorkspace) {
                return Promise.resolve([]);
            }
            return linter.lint(document, cancelToken.token);
        });
        this.documentHasJupyterCodeCells(document, cancelToken.token).then(hasJupyterCodeCells => {
            // linters will resolve asynchronously - keep a track of all 
            // diagnostics reported as them come in
            let diagnostics: vscode.Diagnostic[] = [];

            promises.forEach(p => {
                p.then(msgs => {
                    if (cancelToken.token.isCancellationRequested) {
                        return;
                    }

                    // Build the message and suffix the message with the name of the linter used
                    msgs.forEach(d => {
                        // ignore magic commands from jupyter
                        if (hasJupyterCodeCells && document.lineAt(d.line - 1).text.trim().startsWith('%') &&
                            (d.code === LinterErrors.pylint.InvalidSyntax ||
                                d.code === LinterErrors.prospector.InvalidSyntax ||
                                d.code === LinterErrors.flake8.InvalidSyntax)) {
                            return;
                        }
                        diagnostics.push(createDiagnostics(d, document));
                    });

                    // Limit the number of messages to the max value
                    diagnostics = diagnostics.filter((value, index) => index <= settings.linting.maxNumberOfProblems);

                    if (!this.isDocumentOpen(document.uri)) {
                        diagnostics = [];
                    }
                    // set all diagnostics found in this pass, as this method always clears existing diagnostics.
                    this.diagnosticCollection.set(document.uri, diagnostics);
                });
            });
        });
    }
}
