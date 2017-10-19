import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { IS_MULTI_ROOT_TEST } from './initialize';

const fileInNonRootWorkspace = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
export const rootWorkspaceUri = getWorkspaceRoot();

export type PythonSettingKeys = 'workspaceSymbols.enabled' | 'pythonPath' |
    'linting.lintOnSave' | 'linting.lintOnTextChange' |
    'linting.enabled' | 'linting.pylintEnabled' |
    'linting.flake8Enabled' | 'linting.pep8Enabled' | 'linting.pylamaEnabled' |
    'linting.prospectorEnabled' | 'linting.pydocstyleEnabled' | 'linting.mypyEnabled' |
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs' |
    'formatting.formatOnSave' | 'formatting.provider' | 'sortImports.args';

export async function updateSetting(setting: PythonSettingKeys, value: {}, resource: Uri, configTarget: ConfigurationTarget) {
    const settings = workspace.getConfiguration('python', resource);
    const currentValue = settings.inspect(setting);
    if (currentValue !== undefined && ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
        (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
        (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
        PythonSettings.dispose();
        return;
    }
    // tslint:disable-next-line:await-promise
    await settings.update(setting, value, configTarget);
    if (configTarget === ConfigurationTarget.Workspace && IS_MULTI_ROOT_TEST) {
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    PythonSettings.dispose();
}

function getWorkspaceRoot() {
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return Uri.file(path.join(__dirname, '..', '..', 'src', 'test'));
    }
    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    }
    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace));
    return workspaceFolder ? workspaceFolder.uri : workspace.workspaceFolders[0].uri;
}
