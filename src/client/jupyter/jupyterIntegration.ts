/* eslint-disable comma-dangle */

/* eslint-disable implicit-arrow-linebreak */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { dirname } from 'path';
import { CancellationToken, Event, Extension, Memento, Uri } from 'vscode';
import type { SemVer } from 'semver';
import { IContextKeyManager, IWorkspaceService } from '../common/application/types';
import { JUPYTER_EXTENSION_ID, PYLANCE_EXTENSION_ID } from '../common/constants';
import { InterpreterUri, ModuleInstallFlags } from '../common/installer/types';
import {
    GLOBAL_MEMENTO,
    IExtensions,
    IInstaller,
    IMemento,
    InstallerResponse,
    Product,
    ProductInstallStatus,
    Resource,
} from '../common/types';
import { getDebugpyPackagePath } from '../debugger/extension/adapter/remoteLaunchers';
import { IEnvironmentActivationService } from '../interpreter/activation/types';
import { IInterpreterQuickPickItem, IInterpreterSelector } from '../interpreter/configuration/types';
import {
    IComponentAdapter,
    ICondaService,
    IInterpreterDisplay,
    IInterpreterService,
    IInterpreterStatusbarVisibilityFilter,
    PythonEnvironmentsChangedEvent,
} from '../interpreter/contracts';
import { PythonEnvironment } from '../pythonEnvironments/info';
import { IDataViewerDataProvider, IJupyterUriProvider } from './types';
import { PylanceApi } from '../activation/node/pylanceApi';
import { ExtensionContextKey } from '../common/application/contextKeys';
/**
 * This allows Python extension to update Product enum without breaking Jupyter.
 * I.e. we have a strict contract, else using numbers (in enums) is bound to break across products.
 */
enum JupyterProductToInstall {
    jupyter = 'jupyter',
    ipykernel = 'ipykernel',
    notebook = 'notebook',
    kernelspec = 'kernelspec',
    nbconvert = 'nbconvert',
    pandas = 'pandas',
    pip = 'pip',
}

const ProductMapping: { [key in JupyterProductToInstall]: Product } = {
    [JupyterProductToInstall.ipykernel]: Product.ipykernel,
    [JupyterProductToInstall.jupyter]: Product.jupyter,
    [JupyterProductToInstall.kernelspec]: Product.kernelspec,
    [JupyterProductToInstall.nbconvert]: Product.nbconvert,
    [JupyterProductToInstall.notebook]: Product.notebook,
    [JupyterProductToInstall.pandas]: Product.pandas,
    [JupyterProductToInstall.pip]: Product.pip,
};

type PythonApiForJupyterExtension = {
    /**
     * IInterpreterService
     */
    onDidChangeInterpreter: Event<Uri | undefined>;
    /**
     * IInterpreterService
     */
    readonly refreshPromise: Promise<void> | undefined;
    /**
     * IInterpreterService
     */
    readonly onDidChangeInterpreters: Event<PythonEnvironmentsChangedEvent>;
    /**
     * Equivalent to getInterpreters() in IInterpreterService
     */
    getKnownInterpreters(resource?: Uri): PythonEnvironment[];
    /**
     * @deprecated Use `getKnownInterpreters`, `onDidChangeInterpreters`, and `refreshPromise` instead.
     * Equivalent to getAllInterpreters() in IInterpreterService
     */
    getInterpreters(resource?: Uri): Promise<PythonEnvironment[]>;
    /**
     * IInterpreterService
     */
    getActiveInterpreter(resource?: Uri): Promise<PythonEnvironment | undefined>;
    /**
     * IInterpreterService
     */
    getInterpreterDetails(pythonPath: string, resource?: Uri): Promise<undefined | PythonEnvironment>;

    /**
     * IEnvironmentActivationService
     */
    getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined>;
    isMicrosoftStoreInterpreter(pythonPath: string): Promise<boolean>;
    suggestionToQuickPickItem(suggestion: PythonEnvironment, workspaceUri?: Uri | undefined): IInterpreterQuickPickItem;
    getKnownSuggestions(resource: Resource): IInterpreterQuickPickItem[];
    /**
     * @deprecated Use `getKnownSuggestions` and `suggestionToQuickPickItem` instead.
     */
    getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]>;
    /**
     * IInstaller
     */
    install(
        product: JupyterProductToInstall,
        resource?: InterpreterUri,
        cancel?: CancellationToken,
        reInstallAndUpdate?: boolean,
        installPipIfRequired?: boolean,
    ): Promise<InstallerResponse>;
    /**
     * IInstaller
     */
    isProductVersionCompatible(
        product: Product,
        semVerRequirement: string,
        resource?: InterpreterUri,
    ): Promise<ProductInstallStatus>;
    /**
     * Returns path to where `debugpy` is. In python extension this is `/pythonFiles/lib/python`.
     */
    getDebuggerPath(): Promise<string>;
    /**
     * Retrieve interpreter path selected for Jupyter server from Python memento storage
     */
    getInterpreterPathSelectedForJupyterServer(): string | undefined;
    /**
     * Registers a visibility filter for the interpreter status bar.
     */
    registerInterpreterStatusFilter(filter: IInterpreterStatusbarVisibilityFilter): void;
    getCondaVersion(): Promise<SemVer | undefined>;
    /**
     * Returns the conda executable.
     */
    getCondaFile(): Promise<string | undefined>;
    getEnvironmentActivationShellCommands(
        resource: Resource,
        interpreter?: PythonEnvironment,
    ): Promise<string[] | undefined>;

    /**
     * Call to provide a function that the Python extension can call to request the Python
     * path to use for a particular notebook.
     * @param func : The function that Python should call when requesting the Python path.
     */
    registerJupyterPythonPathFunction(func: (uri: Uri) => Promise<string | undefined>): void;

    /**
     * Call to provide a function that the Python extension can call to request the notebook
     * document URI related to a particular text document URI, or undefined if there is no
     * associated notebook.
     * @param func : The function that Python should call when requesting the notebook URI.
     */
    registerGetNotebookUriForTextDocumentUriFunction(func: (textDocumentUri: Uri) => Uri | undefined): void;
};

type JupyterExtensionApi = {
    /**
     * Registers python extension specific parts with the jupyter extension
     * @param interpreterService
     */
    registerPythonApi(interpreterService: PythonApiForJupyterExtension): void;
    /**
     * Launches Data Viewer component.
     * @param {IDataViewerDataProvider} dataProvider Instance that will be used by the Data Viewer component to fetch data.
     * @param {string} title Data Viewer title
     */
    showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void>;
    /**
     * Registers a remote server provider component that's used to pick remote jupyter server URIs
     * @param serverProvider object called back when picking jupyter server URI
     */
    registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void;
};

@injectable()
export class JupyterExtensionIntegration {
    private jupyterExtension: Extension<JupyterExtensionApi> | undefined;

    private pylanceExtension: Extension<PylanceApi> | undefined;

    private jupyterPythonPathFunction: ((uri: Uri) => Promise<string | undefined>) | undefined;

    private getNotebookUriForTextDocumentUriFunction: ((textDocumentUri: Uri) => Uri | undefined) | undefined;

    constructor(
        @inject(IExtensions) private readonly extensions: IExtensions,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterSelector) private readonly interpreterSelector: IInterpreterSelector,
        @inject(IInstaller) private readonly installer: IInstaller,
        @inject(IEnvironmentActivationService) private readonly envActivation: IEnvironmentActivationService,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private globalState: Memento,
        @inject(IInterpreterDisplay) private interpreterDisplay: IInterpreterDisplay,
        @inject(IComponentAdapter) private pyenvs: IComponentAdapter,
        @inject(IWorkspaceService) private workspaceService: IWorkspaceService,
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IContextKeyManager) private readonly contextManager: IContextKeyManager,
    ) {}

    public registerApi(jupyterExtensionApi: JupyterExtensionApi): JupyterExtensionApi | undefined {
        this.contextManager.setContext(ExtensionContextKey.IsJupyterInstalled, true);
        if (!this.workspaceService.isTrusted) {
            this.workspaceService.onDidGrantWorkspaceTrust(() => this.registerApi(jupyterExtensionApi));
            return undefined;
        }
        // Forward python parts
        jupyterExtensionApi.registerPythonApi({
            onDidChangeInterpreter: this.interpreterService.onDidChangeInterpreter,
            getActiveInterpreter: async (resource?: Uri) => this.interpreterService.getActiveInterpreter(resource),
            getInterpreterDetails: async (pythonPath: string) =>
                this.interpreterService.getInterpreterDetails(pythonPath),
            refreshPromise: this.interpreterService.refreshPromise,
            onDidChangeInterpreters: this.interpreterService.onDidChangeInterpreters,
            getKnownInterpreters: (resource: Uri | undefined) => this.pyenvs.getInterpreters(resource),
            getInterpreters: async (resource: Uri | undefined) => this.interpreterService.getAllInterpreters(resource),
            getActivatedEnvironmentVariables: async (
                resource: Resource,
                interpreter?: PythonEnvironment,
                allowExceptions?: boolean,
            ) => this.envActivation.getActivatedEnvironmentVariables(resource, interpreter, allowExceptions),
            isMicrosoftStoreInterpreter: async (pythonPath: string): Promise<boolean> =>
                this.pyenvs.isMicrosoftStoreInterpreter(pythonPath),
            getSuggestions: async (resource: Resource): Promise<IInterpreterQuickPickItem[]> =>
                this.interpreterSelector.getAllSuggestions(resource),
            getKnownSuggestions: (resource: Resource): IInterpreterQuickPickItem[] =>
                this.interpreterSelector.getSuggestions(resource),
            suggestionToQuickPickItem: (
                suggestion: PythonEnvironment,
                workspaceUri?: Uri | undefined,
            ): IInterpreterQuickPickItem =>
                this.interpreterSelector.suggestionToQuickPickItem(suggestion, workspaceUri),
            install: async (
                product: JupyterProductToInstall,
                resource?: InterpreterUri,
                cancel?: CancellationToken,
                reInstallAndUpdate?: boolean,
                installPipIfRequired?: boolean,
            ): Promise<InstallerResponse> => {
                let flags =
                    reInstallAndUpdate === true
                        ? ModuleInstallFlags.updateDependencies | ModuleInstallFlags.reInstall
                        : undefined;
                if (installPipIfRequired === true) {
                    flags = flags
                        ? flags | ModuleInstallFlags.installPipIfRequired
                        : ModuleInstallFlags.installPipIfRequired;
                }
                return this.installer.install(ProductMapping[product], resource, cancel, flags);
            },
            isProductVersionCompatible: async (
                product: Product,
                semVerRequirement: string,
                resource?: InterpreterUri,
            ): Promise<ProductInstallStatus> =>
                this.installer.isProductVersionCompatible(product, semVerRequirement, resource),
            getDebuggerPath: async () => dirname(getDebugpyPackagePath()),
            getInterpreterPathSelectedForJupyterServer: () =>
                this.globalState.get<string | undefined>('INTERPRETER_PATH_SELECTED_FOR_JUPYTER_SERVER'),
            registerInterpreterStatusFilter: this.interpreterDisplay.registerVisibilityFilter.bind(
                this.interpreterDisplay,
            ),
            getCondaFile: () => this.condaService.getCondaFile(),
            getCondaVersion: () => this.condaService.getCondaVersion(),
            getEnvironmentActivationShellCommands: (resource: Resource, interpreter?: PythonEnvironment) =>
                this.envActivation.getEnvironmentActivationShellCommands(resource, interpreter),
            registerJupyterPythonPathFunction: (func: (uri: Uri) => Promise<string | undefined>) =>
                this.registerJupyterPythonPathFunction(func),
            registerGetNotebookUriForTextDocumentUriFunction: (func: (textDocumentUri: Uri) => Uri | undefined) =>
                this.registerGetNotebookUriForTextDocumentUriFunction(func),
        });
        return undefined;
    }

    public async integrateWithJupyterExtension(): Promise<void> {
        const api = await this.getExtensionApi();
        if (api) {
            this.registerApi(api);
        }
    }

    public registerRemoteServerProvider(serverProvider: IJupyterUriProvider): void {
        this.getExtensionApi()
            .then((e) => {
                if (e) {
                    e.registerRemoteServerProvider(serverProvider);
                }
            })
            .ignoreErrors();
    }

    public async showDataViewer(dataProvider: IDataViewerDataProvider, title: string): Promise<void> {
        const api = await this.getExtensionApi();
        if (api) {
            return api.showDataViewer(dataProvider, title);
        }
        return undefined;
    }

    private async getExtensionApi(): Promise<JupyterExtensionApi | undefined> {
        if (!this.pylanceExtension) {
            const pylanceExtension = this.extensions.getExtension<PylanceApi>(PYLANCE_EXTENSION_ID);

            if (pylanceExtension && !pylanceExtension.isActive) {
                await pylanceExtension.activate();
            }

            this.pylanceExtension = pylanceExtension;
        }

        if (!this.jupyterExtension) {
            const jupyterExtension = this.extensions.getExtension<JupyterExtensionApi>(JUPYTER_EXTENSION_ID);
            if (!jupyterExtension) {
                return undefined;
            }
            await jupyterExtension.activate();
            if (jupyterExtension.isActive) {
                this.jupyterExtension = jupyterExtension;
                return this.jupyterExtension.exports;
            }
        } else {
            return this.jupyterExtension.exports;
        }
        return undefined;
    }

    private getPylanceApi(): PylanceApi | undefined {
        const api = this.pylanceExtension?.exports;
        return api && api.notebook && api.client && api.client.isEnabled() ? api : undefined;
    }

    private registerJupyterPythonPathFunction(func: (uri: Uri) => Promise<string | undefined>) {
        this.jupyterPythonPathFunction = func;

        const api = this.getPylanceApi();
        if (api) {
            api.notebook!.registerJupyterPythonPathFunction(func);
        }
    }

    public getJupyterPythonPathFunction(): ((uri: Uri) => Promise<string | undefined>) | undefined {
        return this.jupyterPythonPathFunction;
    }

    public registerGetNotebookUriForTextDocumentUriFunction(func: (textDocumentUri: Uri) => Uri | undefined): void {
        this.getNotebookUriForTextDocumentUriFunction = func;

        const api = this.getPylanceApi();
        if (api) {
            api.notebook!.registerGetNotebookUriForTextDocumentUriFunction(func);
        }
    }

    public getGetNotebookUriForTextDocumentUriFunction(): ((textDocumentUri: Uri) => Uri | undefined) | undefined {
        return this.getNotebookUriForTextDocumentUriFunction;
    }
}
