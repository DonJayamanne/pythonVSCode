// 'use strict';
// import * as path from 'path';
// import { commands, ConfigurationTarget, Disposable, QuickPickItem, QuickPickOptions, Uri, window, workspace } from 'vscode';
// import { InterpreterManager } from '../interpreter';
// import { PythonInterpreter, WorkspacePythonPath } from '../interpreter/contracts';
// import * as settings from './../common/configSettings';
// import { ShebangCodeLensProvider } from './shebangCodeLensProvider';

// // tslint:disable-next-line:interface-name
// interface PythonPathQuickPickItem extends QuickPickItem {
//     path: string;
// }

// export class SetInterpreterProvider implements Disposable {
//     private disposables: Disposable[] = [];
//     constructor(private interpreterManager: InterpreterManager) {
//         this.disposables.push(commands.registerCommand('python.setInterpreter', this.setInterpreter.bind(this)));
//         this.disposables.push(commands.registerCommand('python.setShebangInterpreter', this.setShebangInterpreter.bind(this)));
//     }
//     public dispose() {
//         this.disposables.forEach(disposable => disposable.dispose());
//     }
//     private async getWorkspaceToSetPythonPath(): Promise<WorkspacePythonPath | undefined> {
//         if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
//             return undefined;
//         }
//         if (workspace.workspaceFolders.length === 1) {
//             return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
//         }

//         // Ok we have multiple interpreters, get the user to pick a folder.
//         // tslint:disable-next-line:no-any prefer-type-cast
//         const workspaceFolder = await (window as any).showWorkspaceFolderPick({ placeHolder: 'Select a workspace' });
//         return workspaceFolder ? { folderUri: workspaceFolder.uri, configTarget: ConfigurationTarget.WorkspaceFolder } : undefined;
//     }
//     private async suggestionToQuickPickItem(suggestion: PythonInterpreter, workspaceUri?: Uri): Promise<PythonPathQuickPickItem> {
//         let detail = suggestion.path;
//         if (workspaceUri && suggestion.path.startsWith(workspaceUri.fsPath)) {
//             detail = `.${path.sep}${path.relative(workspaceUri.fsPath, suggestion.path)}`;
//         }
//         return {
//             // tslint:disable-next-line:no-non-null-assertion
//             label: suggestion.displayName!,
//             description: suggestion.companyDisplayName || '',
//             detail: detail,
//             path: suggestion.path
//         };
//     }

//     private async getSuggestions(resourceUri?: Uri) {
//         const interpreters = await this.interpreterManager.getInterpreters(resourceUri);
//         // tslint:disable-next-line:no-non-null-assertion
//         interpreters.sort((a, b) => a.displayName! > b.displayName! ? 1 : -1);
//         return Promise.all(interpreters.map(item => this.suggestionToQuickPickItem(item, resourceUri)));
//     }

//     private async setInterpreter() {
//         const setInterpreterGlobally = !Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0;
//         let targetConfig: WorkspacePythonPath;
//         if (!setInterpreterGlobally) {
//             targetConfig = await this.getWorkspaceToSetPythonPath();
//             if (!targetConfig) {
//                 return;
//             }
//         }

//         const resourceUri = targetConfig ? targetConfig.folderUri : undefined;
//         const suggestions = await this.getSuggestions(resourceUri);
//         let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
//         if (targetConfig && targetConfig.folderUri && currentPythonPath.startsWith(targetConfig.folderUri.fsPath)) {
//             currentPythonPath = `.${path.sep}${path.relative(targetConfig.folderUri.fsPath, currentPythonPath)}`;
//         }
//         const quickPickOptions: QuickPickOptions = {
//             matchOnDetail: true,
//             matchOnDescription: true,
//             placeHolder: `current: ${currentPythonPath}`
//         };

//         const selection = await window.showQuickPick(suggestions, quickPickOptions);
//         if (selection !== undefined) {
//             await this.interpreterManager.setPythonPath(selection.path, targetConfig);
//         }
//     }

//     private async setShebangInterpreter(): Promise<void> {
//         const shebang = await ShebangCodeLensProvider.detectShebang(window.activeTextEditor.document);
//         if (!shebang) {
//             return;
//         }

//         const pythonPathValue = workspace.getConfiguration('python', window.activeTextEditor.document.uri).inspect<string>('pythonPath');
//         const isGlobalChange = !Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0;
//         const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
//         const isWorkspaceChange = Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length === 1;

//         if (isGlobalChange) {
//             if (!pythonPathValue || typeof pythonPathValue.globalValue !== 'string' || pythonPathValue.globalValue !== shebang) {
//                 await this.interpreterManager.setPythonPath(shebang);
//             }
//             return;
//         }

//         if (isWorkspaceChange || !workspaceFolder) {
//             if (!pythonPathValue || typeof pythonPathValue.workspaceValue !== 'string' || pythonPathValue.workspaceValue !== shebang) {
//                 const targetInfo: WorkspacePythonPath = { configTarget: ConfigurationTarget.Workspace, folderUri: workspace.workspaceFolders[0].uri };
//                 await this.interpreterManager.setPythonPath(shebang, targetInfo);
//             }
//             return;
//         }

//         if (!pythonPathValue || typeof pythonPathValue.workspaceValue !== 'string' || pythonPathValue.workspaceValue !== shebang) {
//             const targetInfo: WorkspacePythonPath = { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
//             await this.interpreterManager.setPythonPath(shebang, targetInfo);
//         }
//     }
// }
