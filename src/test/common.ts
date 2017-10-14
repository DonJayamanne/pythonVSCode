import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';

const fileInNonRootWorkspace = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
export const rootWorkspaceUri = getWorkspaceRoot();

export type PythonSettingKeys = 'workspaceSymbols.enabled' | 'pythonPath' |
    'linting.lintOnSave' | 'linting.lintOnTextChange' |
    'linting.enabled' | 'linting.pylintEnabled' |
    'linting.flake8Enabled' | 'linting.pep8Enabled' |
    'linting.prospectorEnabled' | 'linting.pydocstyleEnabled' |
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs' |
    'formatting.formatOnSave' | 'formatting.provider' | 'sortImports.args';


export async function updateSetting(setting: PythonSettingKeys, value: any, resource: Uri, configTarget: ConfigurationTarget) {
    let settings = workspace.getConfiguration('python', resource);
    const currentValue = settings.inspect(setting);
    if ((configTarget === ConfigurationTarget.Global && currentValue && currentValue.globalValue === value) ||
        (configTarget === ConfigurationTarget.Workspace && currentValue && currentValue.workspaceValue === value) ||
        (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue && currentValue.workspaceFolderValue === value)) {
        PythonSettings.dispose();
        return;
    }
    await settings.update(setting, value, configTarget);
    PythonSettings.dispose();
}

function getWorkspaceRoot() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return Uri.file(path.join(__dirname, '..', '..', 'src', 'test'));
    }
    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    }
    return workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace)).uri;
}
