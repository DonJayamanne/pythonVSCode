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
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs';


export async function updateSetting(setting: PythonSettingKeys, value: any, resource: Uri, configTarget: ConfigurationTarget) {
    let settings = workspace.getConfiguration('python', resource);
    await settings.update(setting, value, configTarget);
    PythonSettings.dispose();
}

function getWorkspaceRoot() {
    //DEBUGGER
    console.log('start');
    if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
        return Uri.file(path.join(__dirname, '..', '..', 'src', 'test'));
    }
    if (workspace.workspaceFolders.length === 1) {
        return workspace.workspaceFolders[0].uri;
    }
    console.log('other');
    try {
        return workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace)).uri;
    }
    catch (ex) {
        console.error('kaboom');
    }
}
