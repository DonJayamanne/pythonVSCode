import * as vscode from 'vscode';
import { Generator } from './generator';
import { Product, Installer } from '../common/installer';
import { PythonSettings } from '../common/configSettings';
import { fsExistsAsync } from '../common/utils';
import { isNotInstalledError } from '../common/helpers';
import { PythonLanguage, Commands } from '../common/constants';
import { WorkspaceSymbolProvider } from './provider';

const pythonSettings = PythonSettings.getInstance();

export class WorkspaceSymbols implements vscode.Disposable {
    private disposables: vscode.Disposable[];
    private generator: Generator;
    private installer: Installer;
    constructor(private outputChannel: vscode.OutputChannel) {
        this.disposables = [];
        this.disposables.push(this.outputChannel);
        this.generator = new Generator(this.outputChannel);
        this.disposables.push(this.generator);
        this.installer = new Installer();
        this.disposables.push(this.installer);
        this.registerCommands();

        // The extension has just loaded, so lets rebuild the tags
        vscode.languages.registerWorkspaceSymbolProvider(new WorkspaceSymbolProvider(this.generator, this.outputChannel));
        this.buildWorkspaceSymbols(true);
    }
    registerCommands() {
        this.disposables.push(vscode.commands.registerCommand(Commands.Build_Workspace_Symbols, this.buildWorkspaceSymbols.bind(this, true)));
    }
    registerOnSaveHandlers() {
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this)));
    }
    onDidSaveTextDocument(textDocument: vscode.TextDocument) {
        if (textDocument.languageId === PythonLanguage.language) {
            this.rebuildTags();
        }
    }
    private timeout: number;
    rebuildTags() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
        this.timeout = setTimeout(() => {
            this.buildWorkspaceSymbols(true);
        }, 5000);
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    disableDocumentLanguageProvider(): Thenable<any> {
        const pythonConfig = vscode.workspace.getConfiguration('python');
        return pythonConfig.update('python.workspaceSymbols.enabled', false);

    }
    buildWorkspaceSymbols(rebuild: boolean = true, token?: vscode.CancellationToken): Promise<any> {
        if (!pythonSettings.workspaceSymbols.enabled || (token && token.isCancellationRequested)) {
            return Promise.resolve([]);
        }
        if (!vscode.workspace || typeof vscode.workspace.rootPath !== 'string' || vscode.workspace.rootPath.length === 0) {
            return Promise.resolve([]);
        }
        return fsExistsAsync(pythonSettings.workspaceSymbols.tagFilePath).then(exits => {
            let promise = Promise.resolve();

            // if file doesn't exist, then run the ctag generator
            // Or check if required to rebuild
            if (rebuild || !exits) {
                promise = this.generator.generateWorkspaceTags();
            }

            return promise.catch(reason => {
                if (!isNotInstalledError(reason)) {
                    this.outputChannel.show();
                    return Promise.reject(reason);
                }
                if (!token || token.isCancellationRequested) {
                    return;
                }
                return new Promise<any>((resolve, reject) => {
                    vscode.window.showErrorMessage('CTags needs to be installed to get support for Python workspace symbols',
                        'Install', `Don't ask again`).then(item => {
                            switch (item) {
                                case 'Install': {
                                    this.installer.install(Product.ctags).then(() => {
                                        return this.buildWorkspaceSymbols(rebuild, token);
                                    }).catch(reason => reject(reason));
                                    break;
                                }
                                case `Don't ask again`: {
                                    this.disableDocumentLanguageProvider().then(() => resolve(), reason => reject(reason));
                                    break;
                                }
                            }
                        });
                });
            });
        });
    }
}

