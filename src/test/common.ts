import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';

export const fileInNonRootWorkspace = path.join(__dirname, '..', '..', 'src', 'test', 'symbolFiles');
export const rootWorkspaceUri = workspace.getWorkspaceFolder(Uri.file(fileInNonRootWorkspace)).uri;

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