import * as path from 'path';
import * as vscode from 'vscode';
import type { IExtensionApi } from '../client/api';
import type { IDisposable } from '../client/common/types';
import { IExtensionTestApi, PYTHON_PATH, setPythonPathInWorkspaceRoot } from './common';
import { IS_SMOKE_TEST, JVSC_EXTENSION_ID_FOR_TESTS } from './constants';
import { sleep } from './core';
import { disposeAllDisposables } from './datascience/notebook/helper';

export * from './constants';
export * from './ciConstants';
export const multirootPath = path.join(__dirname, '..', '..', 'src', 'testMultiRootWkspc');

//First thing to be executed.
process.env.VSC_JUPYTER_CI_TEST = '1';

// Ability to use custom python environments for testing
export async function initializePython() {
    await setPythonPathInWorkspaceRoot(PYTHON_PATH);
}

export function isInsiders() {
    return vscode.env.appName.indexOf('Insider') > 0;
}
// tslint:disable-next-line:no-any
export async function initialize(): Promise<IExtensionTestApi> {
    await initializePython();
    const api = await activateExtension();
    // tslint:disable-next-line:no-any
    return (api as any) as IExtensionTestApi;
}

export async function activateExtension() {
    const extension = vscode.extensions.getExtension<IExtensionApi>(JVSC_EXTENSION_ID_FOR_TESTS)!;
    const api = await extension.activate();
    // Wait until its ready to use.
    await api.ready;
    return api;
}
// tslint:disable-next-line:no-any
export async function initializeTest(): Promise<any> {
    await initializePython();
    await closeActiveWindows();
    if (!IS_SMOKE_TEST) {
        // When running smoke tests, we won't have access to these.
        const configSettings = await import('../client/common/configSettings');
        // Dispose any cached python settings (used only in test env).
        configSettings.JupyterSettings.dispose();
    }
}
export async function closeActiveWindows(disposables: IDisposable[] = []): Promise<void> {
    disposeAllDisposables(disposables);
    await closeActiveNotebooks();
    await closeWindowsInternal();
}
export async function closeActiveNotebooks(): Promise<void> {
    if (!vscode.env.appName.toLowerCase().includes('insiders') || !isANotebookOpen()) {
        return;
    }
    // We could have untitled notebooks, close them by reverting changes.
    // tslint:disable-next-line: no-any
    while ((vscode as any).notebook.activeNotebookEditor || vscode.window.activeTextEditor) {
        await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
    // Work around VS Code issues (sometimes notebooks do not get closed).
    // Hence keep trying.
    for (let counter = 0; counter <= 5 && isANotebookOpen(); counter += 1) {
        await sleep(counter * 100);
        await closeWindowsInternal();
    }
}

async function closeWindowsInternal() {
    return new Promise<void>((resolve, reject) => {
        // Attempt to fix #1301.
        // Lets not waste too much time.
        const timer = setTimeout(() => {
            reject(new Error("Command 'workbench.action.closeAllEditors' timed out"));
        }, 15000);
        vscode.commands.executeCommand('workbench.action.closeAllEditors').then(
            () => {
                clearTimeout(timer);
                resolve();
            },
            (ex) => {
                clearTimeout(timer);
                reject(ex);
            }
        );
    });
}

function isANotebookOpen() {
    // tslint:disable
    if (
        Array.isArray((vscode as any).notebook.visibleNotebookEditors) &&
        (vscode as any).notebook.visibleNotebookEditors.length
    ) {
        return true;
    }
    return !!(vscode as any).notebook.activeNotebookEditor;
}
