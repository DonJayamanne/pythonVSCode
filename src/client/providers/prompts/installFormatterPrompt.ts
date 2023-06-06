// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Uri } from 'vscode';
import { inject, injectable } from 'inversify';
import { IDisposableRegistry } from '../../common/types';
import { Common, ToolsExtensions } from '../../common/utils/localize';
import { isExtensionEnabled } from '../../common/vscodeApis/extensionsApi';
import { showInformationMessage } from '../../common/vscodeApis/windowApis';
import { getConfiguration, onDidSaveTextDocument } from '../../common/vscodeApis/workspaceApis';
import { IServiceContainer } from '../../ioc/types';
import {
    doNotShowPromptState,
    inFormatterExtensionExperiment,
    installFormatterExtension,
    updateDefaultFormatter,
} from './promptUtils';
import { AUTOPEP8_EXTENSION, BLACK_EXTENSION, IInstallFormatterPrompt } from './types';

const SHOW_FORMATTER_INSTALL_PROMPT_DONOTSHOW_KEY = 'showFormatterExtensionInstallPrompt';

@injectable()
export class InstallFormatterPrompt implements IInstallFormatterPrompt {
    private currentlyShown = false;

    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) {}

    /*
     * This method is called when the user saves a python file or a cell.
     * Returns true if an extension was selected. Otherwise returns false.
     */
    public async showInstallFormatterPrompt(resource?: Uri): Promise<boolean> {
        if (!inFormatterExtensionExperiment(this.serviceContainer)) {
            return false;
        }

        const promptState = doNotShowPromptState(SHOW_FORMATTER_INSTALL_PROMPT_DONOTSHOW_KEY, this.serviceContainer);
        if (this.currentlyShown || promptState.value) {
            return false;
        }

        const config = getConfiguration('python', resource);
        const formatter = config.get<string>('formatting.provider', 'none');
        if (!['autopep8', 'black'].includes(formatter)) {
            return false;
        }

        const editorConfig = getConfiguration('editor', { uri: resource, languageId: 'python' });
        const defaultFormatter = editorConfig.get<string>('defaultFormatter', '');
        if ([BLACK_EXTENSION, AUTOPEP8_EXTENSION].includes(defaultFormatter)) {
            return false;
        }

        const black = isExtensionEnabled(BLACK_EXTENSION);
        const autopep8 = isExtensionEnabled(AUTOPEP8_EXTENSION);

        let selection: string | undefined;

        if (black || autopep8) {
            this.currentlyShown = true;
            if (black && autopep8) {
                selection = await showInformationMessage(
                    ToolsExtensions.selectMultipleFormattersPrompt,
                    'Black',
                    'Autopep8',
                    Common.doNotShowAgain,
                );
            } else if (black) {
                selection = await showInformationMessage(
                    ToolsExtensions.selectBlackFormatterPrompt,
                    Common.bannerLabelYes,
                    Common.doNotShowAgain,
                );
                if (selection === Common.bannerLabelYes) {
                    selection = 'Black';
                }
            } else if (autopep8) {
                selection = await showInformationMessage(
                    ToolsExtensions.selectAutopep8FormatterPrompt,
                    Common.bannerLabelYes,
                    Common.doNotShowAgain,
                );
                if (selection === Common.bannerLabelYes) {
                    selection = 'Autopep8';
                }
            }
        } else if (formatter === 'black' && !black) {
            this.currentlyShown = true;
            selection = await showInformationMessage(
                ToolsExtensions.installBlackFormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            );
        } else if (formatter === 'autopep8' && !autopep8) {
            this.currentlyShown = true;
            selection = await showInformationMessage(
                ToolsExtensions.installAutopep8FormatterPrompt,
                'Black',
                'Autopep8',
                Common.doNotShowAgain,
            );
        }

        let userSelectedAnExtension = false;
        if (selection === 'Black') {
            if (black) {
                userSelectedAnExtension = true;
                await updateDefaultFormatter(BLACK_EXTENSION, resource);
            } else {
                userSelectedAnExtension = true;
                await installFormatterExtension(BLACK_EXTENSION, resource);
            }
        } else if (selection === 'Autopep8') {
            if (autopep8) {
                userSelectedAnExtension = true;
                await updateDefaultFormatter(AUTOPEP8_EXTENSION, resource);
            } else {
                userSelectedAnExtension = true;
                await installFormatterExtension(AUTOPEP8_EXTENSION, resource);
            }
        } else if (selection === Common.doNotShowAgain) {
            userSelectedAnExtension = false;
            await promptState.updateValue(true);
        } else {
            userSelectedAnExtension = false;
        }

        this.currentlyShown = false;
        return userSelectedAnExtension;
    }
}

export function registerInstallFormatterPrompt(serviceContainer: IServiceContainer): void {
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    const installFormatterPrompt = serviceContainer.get<IInstallFormatterPrompt>(IInstallFormatterPrompt);
    disposables.push(
        onDidSaveTextDocument(async (e) => {
            const editorConfig = getConfiguration('editor', { uri: e.uri, languageId: 'python' });
            if (e.languageId === 'python' && editorConfig.get<boolean>('formatOnSave')) {
                await installFormatterPrompt.showInstallFormatterPrompt(e.uri);
            }
        }),
    );
}
