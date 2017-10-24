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

// tslint:disable-next-line:no-any
export function retryAsync(wrapped: Function, retryCount: number = 2) {
    // tslint:disable-next-line:no-any
    return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
            // tslint:disable-next-line:no-any
            const reasons: any[] = [];

            const makeCall = () => {
                // tslint:disable-next-line:no-unsafe-any no-any
                // tslint:disable-next-line:no-invalid-this
                wrapped.call(this, ...args)
                    // tslint:disable-next-line:no-unsafe-any no-any
                    .then(resolve, (reason: any) => {
                        reasons.push(reason);
                        if (reasons.length >= retryCount) {
                            reject(reasons);
                        } else {
                            // tslint:disable-next-line:no-string-based-set-timeout
                            setTimeout(makeCall, 1);
                        }
                    });
            };

            makeCall();
        });
    };
}

async function clearPythonPathInWorkspaceFolderImpl(resource: string | Uri) {
    if (!IS_MULTI_ROOT_TEST) {
        return;
    }
    const resourceUri = typeof resource === 'string' ? Uri.file(resource) : resource;
    const settings = workspace.getConfiguration('python', resourceUri);
    const value = settings.inspect<string>('pythonPath');
    if (value && typeof value.workspaceFolderValue === 'string') {
        await settings.update('pythonPath', undefined, ConfigurationTarget.WorkspaceFolder);
        PythonSettings.dispose();
    }
    const settings2 = workspace.getConfiguration('python', resourceUri);
    const value2 = settings.inspect<string>('pythonPath');
    const y = '';
}

export const clearPythonPathInWorkspaceFolder = async (resource: string | Uri) => retryAsync(clearPythonPathInWorkspaceFolderImpl)(resource);
