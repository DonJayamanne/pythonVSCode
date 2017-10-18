import { ConfigurationTarget, window, workspace } from 'vscode';
import { WorkspacePythonPath } from './contracts';

export function getFirstNonEmptyLineFromMultilineString(stdout: string) {
    if (!stdout) {
        return '';
    }
    const lines = stdout.split(/\r?\n/g).map(line => line.trim()).filter(line => line.length > 0);
    return lines.length > 0 ? lines[0] : '';
}
export function getActiveWorkspaceUri(): WorkspacePythonPath | undefined {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return undefined;
    }
    if (workspace.workspaceFolders.length === 1) {
        return { folderUri: workspace.workspaceFolders[0].uri, configTarget: ConfigurationTarget.Workspace };
    }
    if (window.activeTextEditor) {
        const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
        if (workspaceFolder) {
            return { configTarget: ConfigurationTarget.WorkspaceFolder, folderUri: workspaceFolder.uri };
        }
    }
    return undefined;
}

export function getInterpretersForEachFolderAndWorkspace(): WorkspacePythonPath[] {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return [];
    }
    const value = workspace.getConfiguration('python').inspect('pythonPath');
    const workspacePythonPath = value && typeof value.workspaceValue === 'string' ? value.workspaceValue : undefined;

    if (workspace.workspaceFolders.length === 1) {
        if (workspacePythonPath) {
            return [{
                folderUri: workspace.workspaceFolders[0].uri,
                pytonPath: workspacePythonPath,
                configTarget: ConfigurationTarget.Workspace
            }];
        }
        else {
            return [];
        }
    }

    const workspaceConfig: WorkspacePythonPath[] = workspacePythonPath ? [{
        folderUri: workspace.workspaceFolders[0].uri,
        pytonPath: workspacePythonPath,
        configTarget: ConfigurationTarget.Workspace
    }] : [];

    return workspace.workspaceFolders.reduce<WorkspacePythonPath[]>((accumulator, folder) => {
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const folderValue = workspace.getConfiguration('python', folder.uri).inspect('pythonPath');

        if (folderValue && typeof folderValue.workspaceFolderValue === 'string' &&
            folderValue.workspaceFolderValue !== workspacePythonPath &&
            accumulator.findIndex(item => item.pytonPath === folderValue.workspaceFolderValue) === -1) {

            const info: WorkspacePythonPath = {
                folderUri: folder.uri,
                pytonPath: folderValue.workspaceFolderValue,
                configTarget: ConfigurationTarget.WorkspaceFolder
            };

            accumulator.push(info);
        }

        return accumulator;
    }, workspaceConfig);
}
