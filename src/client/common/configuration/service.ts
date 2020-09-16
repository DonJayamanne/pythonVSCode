// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { ConfigurationTarget, Uri, WorkspaceConfiguration } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { IWorkspaceService } from '../application/types';
import { JupyterSettings } from '../configSettings';
import { isUnitTestExecution } from '../constants';
import { IConfigurationService, IWatchableJupyterSettings } from '../types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    private readonly workspaceService: IWorkspaceService;
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {
        this.workspaceService = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
    }
    public getSettings(resource?: Uri): IWatchableJupyterSettings {
        return JupyterSettings.getInstance(resource, this.workspaceService);
    }

    public async updateSectionSetting(
        section: string,
        setting: string,
        value?: {},
        resource?: Uri,
        configTarget?: ConfigurationTarget
    ): Promise<void> {
        const defaultSetting = {
            uri: resource,
            target: configTarget || ConfigurationTarget.WorkspaceFolder
        };
        let settingsInfo = defaultSetting;
        if (section === 'jupyter' && configTarget !== ConfigurationTarget.Global) {
            settingsInfo = JupyterSettings.getSettingsUriAndTarget(resource, this.workspaceService);
        }
        const configSection = this.workspaceService.getConfiguration(section, settingsInfo.uri);
        const currentValue = configSection.inspect(setting);

        if (
            currentValue !== undefined &&
            ((configTarget === ConfigurationTarget.Global && currentValue.globalValue === value) ||
                (configTarget === ConfigurationTarget.Workspace && currentValue.workspaceValue === value) ||
                (configTarget === ConfigurationTarget.WorkspaceFolder && currentValue.workspaceFolderValue === value))
        ) {
            return;
        }
        await configSection.update(setting, value, configTarget);
        if (configTarget) {
            await this.verifySetting(configSection, configTarget, setting, value);
        }
    }

    public async updateSetting(
        setting: string,
        value?: {},
        resource?: Uri,
        configTarget?: ConfigurationTarget
    ): Promise<void> {
        return this.updateSectionSetting('jupyter', setting, value, resource, configTarget);
    }

    public isTestExecution(): boolean {
        return process.env.VSC_JUPYTER_CI_TEST === '1';
    }

    private async verifySetting(
        configSection: WorkspaceConfiguration,
        target: ConfigurationTarget,
        settingName: string,
        value?: {}
    ): Promise<void> {
        if (this.isTestExecution() && !isUnitTestExecution()) {
            let retries = 0;
            do {
                const setting = configSection.inspect(settingName);
                if (!setting && value === undefined) {
                    break; // Both are unset
                }
                if (setting && value !== undefined) {
                    // Both specified
                    const actual =
                        target === ConfigurationTarget.Global
                            ? setting.globalValue
                            : target === ConfigurationTarget.Workspace
                            ? setting.workspaceValue
                            : setting.workspaceFolderValue;
                    if (actual === value) {
                        break;
                    }
                }
                // Wait for settings to get refreshed.
                await new Promise((resolve) => setTimeout(resolve, 250));
                retries += 1;
            } while (retries < 20);
        }
    }
}
