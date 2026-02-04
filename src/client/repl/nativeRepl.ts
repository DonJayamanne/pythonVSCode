// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// Native Repl class that holds instance of pythonServer and replController

import { NotebookController, NotebookDocument, QuickPickItem, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { PVSC_EXTENSION_ID } from '../common/constants';
import { showQuickPick } from '../common/vscodeApis/windowApis';
import { getWorkspaceFolders, onDidCloseNotebookDocument } from '../common/vscodeApis/workspaceApis';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { createPythonServer, createPythonServerEnvExt, PythonServer } from './pythonServer';
import { executeNotebookCell, openInteractiveREPL, selectNotebookKernel } from './replCommandHandler';
import { createReplController } from './replController';
import { EventName } from '../telemetry/constants';
import { sendTelemetryEvent } from '../telemetry';
import { VariablesProvider } from './variables/variablesProvider';
import { VariableRequester } from './variables/variableRequester';
import { getTabNameForUri } from './replUtils';
import { getWorkspaceStateValue, updateWorkspaceStateValue } from '../common/persistentState';
import { getEnvironment, useEnvExtension } from '../envExt/api.internal';
import { traceError, traceVerbose } from '../logging';

export const NATIVE_REPL_URI_MEMENTO = 'nativeReplUri';
let nativeRepl: NativeRepl | undefined;
export class NativeRepl implements Disposable {
    // Adding ! since it will get initialized in create method, not the constructor.
    private pythonServer!: PythonServer;

    private cwd: string | undefined;

    private interpreter!: PythonEnvironment;

    private resourceUri: Uri | undefined;

    private disposables: Disposable[] = [];

    private replController!: NotebookController;

    private notebookDocument: NotebookDocument | undefined;

    public newReplSession: boolean | undefined = true;

    // TODO: In the future, could also have attribute of URI for file specific REPL.
    private constructor() {
        this.watchNotebookClosed();
    }

    /**
     * Get the interpreter path associated with this REPL instance.
     * Used to detect when interpreter has changed and REPL needs to be recreated.
     */
    public get interpreterPath(): string {
        return this.interpreter.path;
    }

    // Static async factory method to handle asynchronous initialization
    public static async create(interpreter: PythonEnvironment, resource?: Uri): Promise<NativeRepl> {
        const nativeRepl = new NativeRepl();
        nativeRepl.interpreter = interpreter;
        nativeRepl.resourceUri = resource;
        await nativeRepl.setReplDirectory();

        // Use env extension's runInBackground if available for proper environment handling
        if (useEnvExtension()) {
            const pythonEnv = await getEnvironment(resource);
            if (pythonEnv) {
                traceVerbose(
                    `Creating REPL server using environment extension for: ${pythonEnv.execInfo.run.executable}`,
                );
                nativeRepl.pythonServer = await createPythonServerEnvExt(pythonEnv, nativeRepl.cwd);
            } else {
                traceError('Failed to get environment from env extension, falling back to direct spawn');
                nativeRepl.pythonServer = createPythonServer([interpreter.path as string], nativeRepl.cwd);
            }
        } else {
            traceVerbose(`Creating REPL server using direct spawn for: ${interpreter.path}`);
            nativeRepl.pythonServer = createPythonServer([interpreter.path as string], nativeRepl.cwd);
        }

        nativeRepl.setReplController();

        return nativeRepl;
    }

    dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }

    /**
     * Function that watches for Notebook Closed event.
     * This is for the purposes of correctly updating the notebookEditor and notebookDocument on close.
     */
    private watchNotebookClosed(): void {
        this.disposables.push(
            onDidCloseNotebookDocument(async (nb) => {
                if (this.notebookDocument && nb.uri.toString() === this.notebookDocument.uri.toString()) {
                    this.notebookDocument = undefined;
                    this.newReplSession = true;
                    await updateWorkspaceStateValue<string | undefined>(NATIVE_REPL_URI_MEMENTO, undefined);
                    this.pythonServer.dispose();

                    // Recreate Python server - use env extension if available
                    if (useEnvExtension()) {
                        const pythonEnv = await getEnvironment(this.resourceUri);
                        if (pythonEnv) {
                            this.pythonServer = await createPythonServerEnvExt(pythonEnv, this.cwd);
                        } else {
                            this.pythonServer = createPythonServer([this.interpreter.path as string], this.cwd);
                        }
                    } else {
                        this.pythonServer = createPythonServer([this.interpreter.path as string], this.cwd);
                    }

                    this.disposables.push(this.pythonServer);
                    if (this.replController) {
                        this.replController.dispose();
                    }
                    nativeRepl = undefined;
                }
            }),
        );
    }

    /**
     * Function that set up desired directory for REPL.
     * If there is multiple workspaces, prompt the user to choose
     * which directory we should set in context of native REPL.
     */
    private async setReplDirectory(): Promise<void> {
        // Figure out uri via workspaceFolder as uri parameter always
        // seem to be undefined from parameter when trying to access from replCommands.ts
        const workspaces: readonly WorkspaceFolder[] | undefined = getWorkspaceFolders();

        if (workspaces) {
            // eslint-disable-next-line no-shadow
            const workspacesQuickPickItems: QuickPickItem[] = workspaces.map((workspace) => ({
                label: workspace.name,
                description: workspace.uri.fsPath,
            }));

            if (workspacesQuickPickItems.length === 0) {
                this.cwd = process.cwd(); // Yields '/' on no workspace scenario.
            } else if (workspacesQuickPickItems.length === 1) {
                this.cwd = workspacesQuickPickItems[0].description;
            } else {
                // Show choices of workspaces for user to choose from.
                const selection = (await showQuickPick(workspacesQuickPickItems, {
                    placeHolder: 'Select current working directory for new REPL',
                    matchOnDescription: true,
                    ignoreFocusOut: true,
                })) as QuickPickItem;
                this.cwd = selection?.description;
            }
        }
    }

    /**
     * Function that check if NotebookController for REPL exists, and returns it in Singleton manner.
     */
    public setReplController(): NotebookController {
        if (!this.replController) {
            this.replController = createReplController(
                this.interpreter!.path,
                this.disposables,
                this.cwd,
                this.pythonServer,
            );
            this.replController.variableProvider = new VariablesProvider(
                new VariableRequester(this.pythonServer),
                () => this.notebookDocument,
                this.pythonServer.onCodeExecuted,
            );
        }
        return this.replController;
    }

    /**
     * Function that checks if native REPL's text input box contains complete code.
     * @returns Promise<boolean> - True if complete/Valid code is present, False otherwise.
     */
    public async checkUserInputCompleteCode(activeEditor: TextEditor | undefined): Promise<boolean> {
        let completeCode = false;
        let userTextInput;
        if (activeEditor) {
            const { document } = activeEditor;
            userTextInput = document.getText();
        }

        // Check if userTextInput is a complete Python command
        if (userTextInput) {
            completeCode = await this.pythonServer.checkValidCommand(userTextInput);
        }

        return completeCode;
    }

    /**
     * Function that opens interactive repl, selects kernel, and send/execute code to the native repl.
     */
    public async sendToNativeRepl(code?: string | undefined, preserveFocus: boolean = true): Promise<void> {
        let wsMementoUri: Uri | undefined;

        if (!this.notebookDocument) {
            const wsMemento = getWorkspaceStateValue<string>(NATIVE_REPL_URI_MEMENTO);
            wsMementoUri = wsMemento ? Uri.parse(wsMemento) : undefined;

            if (!wsMementoUri || getTabNameForUri(wsMementoUri) !== 'Python REPL') {
                await updateWorkspaceStateValue<string | undefined>(NATIVE_REPL_URI_MEMENTO, undefined);
                wsMementoUri = undefined;
            }
        }

        const result = await openInteractiveREPL(this.notebookDocument ?? wsMementoUri, preserveFocus);
        if (result) {
            this.notebookDocument = result.notebookEditor.notebook;
            await updateWorkspaceStateValue<string | undefined>(
                NATIVE_REPL_URI_MEMENTO,
                this.notebookDocument.uri.toString(),
            );

            if (result.documentCreated) {
                await selectNotebookKernel(result.notebookEditor, this.replController.id, PVSC_EXTENSION_ID);
            }
            if (code) {
                await executeNotebookCell(result.notebookEditor, code);
            }
        }
    }
}

/**
 * Get Singleton Native REPL Instance.
 * Recreates the REPL if the interpreter has changed (e.g., when using environment extension).
 * @param interpreter
 * @param disposables
 * @param resource - Optional resource URI used to get the environment from the env extension
 * @returns Native REPL instance
 */
export async function getNativeRepl(
    interpreter: PythonEnvironment,
    disposables: Disposable[],
    resource?: Uri,
): Promise<NativeRepl> {
    // Check if interpreter has changed - if so, dispose and recreate the REPL
    // This serves as a fallback in case the event listener didn't catch the change
    if (nativeRepl && nativeRepl.interpreterPath !== interpreter.path) {
        traceVerbose(`Interpreter changed to ${interpreter.path}, disposing Native REPL`);
        nativeRepl.dispose();
        nativeRepl = undefined;
    }

    if (!nativeRepl) {
        nativeRepl = await NativeRepl.create(interpreter, resource);
        disposables.push(nativeRepl);
    }
    if (nativeRepl && nativeRepl.newReplSession) {
        sendTelemetryEvent(EventName.REPL, undefined, { replType: 'Native' });
        nativeRepl.newReplSession = false;
    }
    return nativeRepl;
}
