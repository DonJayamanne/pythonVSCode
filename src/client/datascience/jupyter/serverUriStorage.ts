// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Memento } from 'vscode';
import { IApplicationEnvironment, IEncryptedStorage, IWorkspaceService } from '../../common/application/types';
import { GLOBAL_MEMENTO, IConfigurationService, ICryptoUtils, IMemento } from '../../common/types';
import { Settings } from '../constants';
import { IJupyterServerUriStorage } from '../types';

/**
 * Class for storing Jupyter Server URI values
 */
@injectable()
export class JupyterServerUriStorage implements IJupyterServerUriStorage {
    private currentUriPromise: Promise<string> | undefined;
    constructor(
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(ICryptoUtils) private readonly crypto: ICryptoUtils,
        @inject(IEncryptedStorage) private readonly encryptedStorage: IEncryptedStorage,
        @inject(IApplicationEnvironment) private readonly appEnv: IApplicationEnvironment,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private readonly globalMemento: Memento
    ) {
        // Cache our current state so we don't keep asking for it from the encrypted storage
        this.getUri().ignoreErrors();
    }
    public async addToUriList(uri: string, time: number, displayName: string) {
        // Uri list is saved partially in the global memento and partially in encrypted storage

        // Start with saved list.
        const uriList = await this.getSavedUriList();

        // Remove this uri if already found (going to add again with a new time)
        const editedList = uriList.filter((f, i) => {
            return f.uri !== uri && i < Settings.JupyterServerUriListMax - 1;
        });

        // Add this entry into the liast
        editedList.push({ uri, time, displayName: displayName || uri });

        // Sort based on time. Newest time first
        const sorted = editedList.sort((a, b) => {
            return b.time - a.time;
        });

        // Transform the sorted into just indexes. Uris can't show up in
        // non encrypted storage (so remove even the display name)
        const mementoList = sorted.map((v, i) => {
            return { index: i, time: v.time };
        });

        // Then write just the indexes to global memento
        await this.globalMemento.update(Settings.JupyterServerUriList, mementoList);

        // Write the uris to the storage in one big blob (max length issues?)
        // This is because any part of the URI may be a secret (we don't know it's just token values for instance)
        const blob = sorted
            .map(
                (e) =>
                    `${e.uri}${Settings.JupyterServerRemoteLaunchNameSeparator}${
                        !e.displayName || e.displayName === e.uri
                            ? Settings.JupyterServerRemoteLaunchUriEqualsDisplayName
                            : e.displayName
                    }`
            )
            .join(Settings.JupyterServerRemoteLaunchUriSeparator);
        return this.encryptedStorage.store(
            Settings.JupyterServerRemoteLaunchService,
            Settings.JupyterServerRemoteLaunchUriListKey,
            blob
        );
    }
    public async getSavedUriList(): Promise<{ uri: string; time: number; displayName?: string | undefined }[]> {
        // List is in the global memento, URIs are in encrypted storage
        const indexes = this.globalMemento.get<{ index: number; time: number }[]>(Settings.JupyterServerUriList);
        if (indexes && indexes.length > 0) {
            // Pull out the \r separated URI list (\r is an invalid URI character)
            const blob = await this.encryptedStorage.retrieve(
                Settings.JupyterServerRemoteLaunchService,
                Settings.JupyterServerRemoteLaunchUriListKey
            );
            if (blob) {
                // Make sure same length
                const split = blob.split(Settings.JupyterServerRemoteLaunchUriSeparator);
                const result = [];
                for (let i = 0; i < split.length && i < indexes.length; i += 1) {
                    // Split out the display name and the URI (they were combined because display name may have secret tokens in it too)
                    const uriAndDisplayName = split[i].split(Settings.JupyterServerRemoteLaunchNameSeparator);
                    const uri = uriAndDisplayName[0];

                    // 'same' is specified for the display name to keep storage shorter if it is the same value as the URI
                    const displayName =
                        uriAndDisplayName[1] === Settings.JupyterServerRemoteLaunchUriEqualsDisplayName ||
                        !uriAndDisplayName[1]
                            ? uri
                            : uriAndDisplayName[1];
                    result.push({ time: indexes[i].time, displayName, uri });
                }
                return result;
            }
        }
        return [];
    }
    public async clearUriList(): Promise<void> {
        // Clear out memento and encrypted storage
        await this.globalMemento.update(Settings.JupyterServerUriList, []);
        await this.encryptedStorage.store(
            Settings.JupyterServerRemoteLaunchService,
            Settings.JupyterServerRemoteLaunchUriListKey,
            undefined
        );
    }
    public getUri(): Promise<string> {
        if (!this.currentUriPromise) {
            this.currentUriPromise = this.getUriInternal();
        }

        return this.currentUriPromise;
    }

    public async setUri(uri: string) {
        // Set the URI as our current state
        this.currentUriPromise = Promise.resolve(uri);

        if (uri === Settings.JupyterServerLocalLaunch) {
            // Just save directly into the settings
            await this.configService.updateSetting(
                'jupyterServerType',
                Settings.JupyterServerLocalLaunch,
                undefined,
                ConfigurationTarget.Workspace
            );
        } else {
            // This is a remote setting. Save in the settings as remote
            await this.configService.updateSetting(
                'jupyterServerType',
                Settings.JupyterServerRemoteLaunch,
                undefined,
                ConfigurationTarget.Workspace
            );

            // Save in the storage (unique account per workspace)
            const key = this.getUriAccountKey();
            await this.encryptedStorage.store(Settings.JupyterServerRemoteLaunchService, key, uri);
        }
    }

    private async getUriInternal(): Promise<string> {
        const uri = this.configService.getSettings(undefined).jupyterServerType;
        if (uri === Settings.JupyterServerLocalLaunch || uri.length === 0) {
            return Settings.JupyterServerLocalLaunch;
        } else {
            // If settings has a token in it, remove it
            if (uri !== Settings.JupyterServerRemoteLaunch) {
                await this.setUri(uri);
            }

            // Should be stored in encrypted storage based on the workspace
            const key = this.getUriAccountKey();
            const storedUri = await this.encryptedStorage.retrieve(Settings.JupyterServerRemoteLaunchService, key);

            return storedUri || uri;
        }
    }

    /**
     * Returns a unique identifier for the current workspace
     */
    private getUriAccountKey(): string {
        if (this.workspaceService.rootPath) {
            // Folder situation
            return this.crypto.createHash(this.workspaceService.rootPath, 'string', 'SHA512');
        } else if (this.workspaceService.workspaceFile) {
            // Workspace situation
            return this.crypto.createHash(this.workspaceService.workspaceFile.fsPath, 'string', 'SHA512');
        }
        return this.appEnv.machineId; // Global key when no folder or workspace file
    }
}
