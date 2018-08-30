import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../client/common/configSettings';
import { sleep } from './core';
import { IS_MULTI_ROOT_TEST } from './initialize';

export * from './core';

// tslint:disable:no-non-null-assertion no-unsafe-any await-promise no-any no-use-before-declare no-string-based-set-timeout no-unsafe-any no-any no-invalid-this

const fileInNonRootWorkspace = path.join(__dirname, '..', '..', 'src', 'test', 'pythonFiles', 'dummy.py');
export const rootWorkspaceUri = getWorkspaceRoot();

export const PYTHON_PATH = getPythonPath();

export type PythonSettingKeys = 'workspaceSymbols.enabled' | 'pythonPath' |
    'linting.lintOnSave' |
    'linting.enabled' | 'linting.pylintEnabled' |
    'linting.flake8Enabled' | 'linting.pep8Enabled' | 'linting.pylamaEnabled' |
    'linting.prospectorEnabled' | 'linting.pydocstyleEnabled' | 'linting.mypyEnabled' |
    'unitTest.nosetestArgs' | 'unitTest.pyTestArgs' | 'unitTest.unittestArgs' |
    'formatting.provider' | 'sortImports.args' |
    'unitTest.nosetestsEnabled' | 'unitTest.pyTestEnabled' | 'unitTest.unittestEnabled' |
    'envFile';

export async function updateSetting(setting: PythonSettingKeys, value: {} | undefined, resource: Uri | undefined, configTarget: ConfigurationTarget) {
    const settings = workspace.getConfiguration('python', resource);
    const currentValue = settings.inspect(setting);
    if (currentValue !== undefined && ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
        (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
        (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))) {
        PythonSettings.dispose();
        return;
    }
    await settings.update(setting, value, configTarget);
    await sleep(2000);
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

export function retryAsync(wrapped: Function, retryCount: number = 2) {
    return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
            const reasons: any[] = [];

            const makeCall = () => {
                wrapped.call(this as Function, ...args)
                    .then(resolve, (reason: any) => {
                        reasons.push(reason);
                        if (reasons.length >= retryCount) {
                            reject(reasons);
                        } else {
                            // If failed once, lets wait for some time before trying again.
                            setTimeout(makeCall, 500);
                        }
                    });
            };

            makeCall();
        });
    };
}

async function setPythonPathInWorkspace(resource: string | Uri | undefined, config: ConfigurationTarget, pythonPath?: string) {
    if (config === ConfigurationTarget.WorkspaceFolder && !IS_MULTI_ROOT_TEST) {
        return;
    }
    const resourceUri = typeof resource === 'string' ? Uri.file(resource) : resource;
    const settings = workspace.getConfiguration('python', resourceUri);
    const value = settings.inspect<string>('pythonPath');
    const prop: 'workspaceFolderValue' | 'workspaceValue' = config === ConfigurationTarget.Workspace ? 'workspaceValue' : 'workspaceFolderValue';
    if (value && value[prop] !== pythonPath) {
        await settings.update('pythonPath', pythonPath, config);
        PythonSettings.dispose();
    }
}
async function restoreGlobalPythonPathSetting(): Promise<void> {
    const pythonConfig = workspace.getConfiguration('python', null as any as Uri);
    const currentGlobalPythonPathSetting = pythonConfig.inspect('pythonPath')!.globalValue;
    if (globalPythonPathSetting !== currentGlobalPythonPathSetting) {
        await pythonConfig.update('pythonPath', undefined, true);
    }
    PythonSettings.dispose();
}

export async function deleteDirectory(dir: string) {
    const exists = await fs.pathExists(dir);
    if (exists) {
        await fs.remove(dir);
    }
}
export async function deleteFile(file: string) {
    const exists = await fs.pathExists(file);
    if (exists) {
        await fs.remove(file);
    }
}

// In some tests we will be mocking VS Code API (mocked classes)
const globalPythonPathSetting = workspace.getConfiguration('python') ? workspace.getConfiguration('python').inspect('pythonPath')!.globalValue : 'python';
export const clearPythonPathInWorkspaceFolder = async (resource: string | Uri) => retryAsync(setPythonPathInWorkspace)(resource, ConfigurationTarget.WorkspaceFolder);
export const setPythonPathInWorkspaceRoot = async (pythonPath: string) => retryAsync(setPythonPathInWorkspace)(undefined, ConfigurationTarget.Workspace, pythonPath);
export const resetGlobalPythonPathSetting = async () => retryAsync(restoreGlobalPythonPathSetting)();

function getPythonPath(): string {
    if (process.env.TRAVIS_PYTHON_PATH && fs.existsSync(process.env.TRAVIS_PYTHON_PATH)) {
        return process.env.TRAVIS_PYTHON_PATH;
    }
    return 'python';
}
