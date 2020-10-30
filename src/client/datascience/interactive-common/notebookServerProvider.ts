// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { CancellationToken, ConfigurationTarget, EventEmitter, Uri } from 'vscode';
import { IApplicationShell } from '../../common/application/types';
import { CancellationError, wrapCancellationTokens } from '../../common/cancellation';
import { traceInfo } from '../../common/logger';
import { IConfigurationService } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IInterpreterService } from '../../interpreter/contracts';
import { sendTelemetryEvent } from '../../telemetry';
import { Identifiers, Settings, Telemetry } from '../constants';
import { JupyterInstallError } from '../jupyter/jupyterInstallError';
import { JupyterSelfCertsError } from '../jupyter/jupyterSelfCertsError';
import { JupyterZMQBinariesNotFoundError } from '../jupyter/jupyterZMQBinariesNotFoundError';
import { JupyterServerSelector } from '../jupyter/serverSelector';
import { ProgressReporter } from '../progress/progressReporter';
import {
    GetServerOptions,
    IJupyterExecution,
    IJupyterServerProvider,
    IJupyterServerUriStorage,
    INotebook,
    INotebookServer,
    INotebookServerOptions
} from '../types';

@injectable()
export class NotebookServerProvider implements IJupyterServerProvider {
    private serverPromise: Promise<INotebookServer | undefined> | undefined;
    private allowingUI = false;
    private _notebookCreated = new EventEmitter<{ identity: Uri; notebook: INotebook }>();
    constructor(
        @inject(ProgressReporter) private readonly progressReporter: ProgressReporter,
        @inject(IConfigurationService) private readonly configuration: IConfigurationService,
        @inject(IJupyterExecution) private readonly jupyterExecution: IJupyterExecution,
        @inject(IApplicationShell) private readonly applicationShell: IApplicationShell,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IJupyterServerUriStorage) private readonly serverUriStorage: IJupyterServerUriStorage,
        @inject(JupyterServerSelector) private serverSelector: JupyterServerSelector
    ) {}
    public get onNotebookCreated() {
        return this._notebookCreated.event;
    }

    public async getOrCreateServer(
        options: GetServerOptions,
        token?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        const serverOptions = await this.getNotebookServerOptions();

        // If we are just fetching or only want to create for local, see if exists
        if (options.getOnly || (options.localOnly && !serverOptions.uri)) {
            return this.jupyterExecution.getServer(serverOptions);
        } else {
            // Otherwise create a new server
            return this.createServer(options, token).then((val) => {
                // If we created a new server notify of our first time provider connection
                if (val && options.onConnectionMade) {
                    options.onConnectionMade();
                }

                return val;
            });
        }
    }

    private async createServer(
        options: GetServerOptions,
        token?: CancellationToken
    ): Promise<INotebookServer | undefined> {
        // When we finally try to create a server, update our flag indicating if we're going to allow UI or not. This
        // allows the server to be attempted without a UI, but a future request can come in and use the same startup
        this.allowingUI = options.disableUI ? this.allowingUI : true;

        if (!this.serverPromise) {
            // Start a server
            this.serverPromise = this.startServer(token);
        }
        try {
            return await this.serverPromise;
        } catch (e) {
            // Don't cache the error
            this.serverPromise = undefined;
            throw e;
        }
    }

    private async startServer(token?: CancellationToken): Promise<INotebookServer | undefined> {
        const serverOptions = await this.getNotebookServerOptions();

        traceInfo(`Checking for server existence.`);

        // If the URI is 'remote' then the encrypted storage is not working. Ask user again for server URI
        if (serverOptions.uri === Settings.JupyterServerRemoteLaunch) {
            await this.serverSelector.selectJupyterURI(true);

            // Should have been saved
            serverOptions.uri = await this.serverUriStorage.getUri();
        }

        // Status depends upon if we're about to connect to existing server or not.
        const progressReporter = this.allowingUI
            ? (await this.jupyterExecution.getServer(serverOptions))
                ? this.progressReporter.createProgressIndicator(localize.DataScience.connectingToJupyter())
                : this.progressReporter.createProgressIndicator(localize.DataScience.startingJupyter())
            : undefined;

        // Check to see if we support ipykernel or not
        try {
            traceInfo(`Checking for server usability.`);

            const usable = await this.checkUsable(serverOptions);
            if (!usable) {
                traceInfo('Server not usable (should ask for install now)');
                // Indicate failing.
                throw new JupyterInstallError(
                    localize.DataScience.jupyterNotSupported().format(await this.jupyterExecution.getNotebookError()),
                    localize.DataScience.pythonInteractiveHelpLink()
                );
            }
            // Then actually start the server
            traceInfo(`Starting notebook server.`);
            const result = await this.jupyterExecution.connectToNotebookServer(
                serverOptions,
                wrapCancellationTokens(progressReporter?.token, token)
            );
            traceInfo(`Server started.`);
            return result;
        } catch (e) {
            progressReporter?.dispose(); // NOSONAR
            // If user cancelled, then do nothing.
            if (progressReporter && progressReporter.token.isCancellationRequested && e instanceof CancellationError) {
                return;
            }

            // Also tell jupyter execution to reset its search. Otherwise we've just cached
            // the failure there
            await this.jupyterExecution.refreshCommands();

            if (e instanceof JupyterSelfCertsError) {
                // On a self cert error, warn the user and ask if they want to change the setting
                const enableOption: string = localize.DataScience.jupyterSelfCertEnable();
                const closeOption: string = localize.DataScience.jupyterSelfCertClose();
                this.applicationShell
                    .showErrorMessage(
                        localize.DataScience.jupyterSelfCertFail().format(e.message),
                        enableOption,
                        closeOption
                    )
                    .then((value) => {
                        if (value === enableOption) {
                            sendTelemetryEvent(Telemetry.SelfCertsMessageEnabled);
                            this.configuration
                                .updateSetting(
                                    'allowUnauthorizedRemoteConnection',
                                    true,
                                    undefined,
                                    ConfigurationTarget.Workspace
                                )
                                .ignoreErrors();
                        } else if (value === closeOption) {
                            sendTelemetryEvent(Telemetry.SelfCertsMessageClose);
                        }
                    });
                throw e;
            } else {
                throw e;
            }
        } finally {
            progressReporter?.dispose(); // NOSONAR
        }
    }

    private async checkUsable(options: INotebookServerOptions): Promise<boolean> {
        try {
            if (options && !options.uri) {
                const usableInterpreter = await this.jupyterExecution.getUsableJupyterPython();
                return usableInterpreter ? true : false;
            } else {
                return true;
            }
        } catch (e) {
            if (e instanceof JupyterZMQBinariesNotFoundError) {
                throw e;
            }
            const activeInterpreter = await this.interpreterService.getActiveInterpreter(undefined);
            // Can't find a usable interpreter, show the error.
            if (activeInterpreter) {
                const displayName = activeInterpreter.displayName
                    ? activeInterpreter.displayName
                    : activeInterpreter.path;
                throw new Error(
                    localize.DataScience.jupyterNotSupportedBecauseOfEnvironment().format(displayName, e.toString())
                );
            } else {
                throw new JupyterInstallError(
                    localize.DataScience.jupyterNotSupported().format(await this.jupyterExecution.getNotebookError()),
                    localize.DataScience.pythonInteractiveHelpLink()
                );
            }
        }
    }

    private async getNotebookServerOptions(): Promise<INotebookServerOptions> {
        // Since there's one server per session, don't use a resource to figure out these settings
        let serverURI: string | undefined = await this.serverUriStorage.getUri();
        const useDefaultConfig: boolean | undefined = this.configuration.getSettings(undefined)
            .useDefaultConfigForJupyter;

        // For the local case pass in our URI as undefined, that way connect doesn't have to check the setting
        if (serverURI && serverURI.toLowerCase() === Settings.JupyterServerLocalLaunch) {
            serverURI = undefined;
        }

        return {
            uri: serverURI,
            skipUsingDefaultConfig: !useDefaultConfig,
            purpose: Identifiers.HistoryPurpose,
            allowUI: this.allowUI.bind(this)
        };
    }

    private allowUI(): boolean {
        return this.allowingUI;
    }
}
