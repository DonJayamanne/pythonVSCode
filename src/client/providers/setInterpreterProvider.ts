'use strict';
import * as path from 'path';
import { commands, ConfigurationTarget, Disposable, QuickPickItem, QuickPickOptions, Uri, window, workspace } from 'vscode';
import { InterpreterManager } from '../interpreter';
import { PythonInterpreter, WorkspacePythonPath } from '../interpreter/contracts';
import { getInterpretersForEachFolderAndWorkspace } from '../interpreter/helpers';
import * as settings from './../common/configSettings';
import { ShebangCodeLensProvider } from './shebangCodeLensProvider';

// tslint:disable-next-line:interface-name
interface PythonPathQuickPickItem extends QuickPickItem {
    path: string;
}

export class SetInterpreterProvider implements Disposable {
    private disposables: Disposable[] = [];
    constructor(private interpreterManager: InterpreterManager) {
        this.disposables.push(commands.registerCommand('python.setInterpreter', this.setInterpreter.bind(this)));
        this.disposables.push(commands.registerCommand('python.setShebangInterpreter', this.setShebangInterpreter.bind(this)));
    }
    public dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
    }
    private async getWorkspacePythonPath(): Promise<WorkspacePythonPath | undefined> {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return undefined;
        }
        if (workspace.workspaceFolders.length === 1) {
            return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
        }
        // We could have each workspace folder with different python paths.
        // Or, we could the workspace with a pythonPath and one of the workspace folders with different python paths.
        // Lets just find how many different setups we have.
        const configs = getInterpretersForEachFolderAndWorkspace();
        if (configs.length === 1) {
            return configs[0];
        }

        // Ok we have multiple interpreters, get the user to pick a folder
        const workspaceFolder = await window.showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
        return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined;
    }
    private async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<PythonPathQuickPickItem> {
        let detail = suggestion.path;
        if (workspaceUri && suggestion.path.startsWith(workspaceUri.fsPath)) {
            detail = `.${path.sep}${path.relative(workspaceUri.fsPath, suggestion.path)}`;
        }
        return {
            // tslint:disable-next-line:no-non-null-assertion
            label: suggestion.displayName!,
            description: suggestion.companyDisplayName || '',
            detail: detail,
            path: suggestion.path
        };
    }
    private async presentQuickPick() {
        const targetConfig = await this.getWorkspacePythonPath();
        const resourceUri = targetConfig ? targetConfig.folderUri : undefined;
        const suggestions = await this.getSuggestions(resourceUri);
        let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
        if (workspace.rootPath && currentPythonPath.startsWith(workspace.rootPath)) {
            currentPythonPath = `.${path.sep}${path.relative(workspace.rootPath, currentPythonPath)}`;
        }
        const quickPickOptions: QuickPickOptions = {
            matchOnDetail: true,
            matchOnDescription: true,
            placeHolder: `current: ${currentPythonPath}`
        };
        const selection = await window.showQuickPick(suggestions, quickPickOptions);
        if (selection !== undefined) {
            this.interpreterManager.setPythonPath(selection.path, targetConfig);
        }
    }

    private async getSuggestions(resourceUri?: Uri) {
        const interpreters = await this.interpreterManager.getInterpreters(resourceUri);
        // tslint:disable-next-line:no-non-null-assertion
        interpreters.sort((a, b) => a.displayName! > b.displayName! ? 1 : -1);
        return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)));
    }

    private setInterpreter() {
        this.presentQuickPick();
    }

    private async setShebangInterpreter(): Promise<void> {
        const shebang = await ShebangCodeLensProvider.detectShebang(window.activeTextEditor.document);
        if (!shebang) {
            return;
        }

        const existingConfigs = getInterpretersForEachFolderAndWorkspace();
        const hasFoldersWithPythonPathSet = existingConfigs.filter(item => item.configTarget === ConfigurationTarget.WorkspaceFolder).length > 0;

        const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const value = workspace.getConfiguration('python', window.activeTextEditor.document.uri).inspect('pythonPath');
        const currentValueSetInWorkspaceFolder = value && typeof value.workspaceFolderValue === 'string';

        const setPythonPathInSpecificFolder = hasFoldersWithPythonPathSet || currentValueSetInWorkspaceFolder;
        if (setPythonPathInSpecificFolder) {
            const configTarget = workspaceFolder ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
            const workspaceTarget: WorkspacePythonPath = { folderUri: workspaceFolder.uri, configTarget: configTarget };
            return this.interpreterManager.setPythonPath(shebang, workspaceTarget);
        }

        const setPythonPathInRootWorkspace = Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0;
        if (setPythonPathInRootWorkspace) {
            const configTarget: WorkspacePythonPath = { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
            return this.interpreterManager.setPythonPath(shebang, configTarget);
        }

        return this.interpreterManager.setPythonPath(shebang);
    }
}
