// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../../ioc/types';
import { IWebviewPanelProvider } from '../application/types';
import { WebviewPanelProvider } from '../application/webviewPanels/webviewPanelProvider';
import { InsidersBuildInstaller, StableBuildInstaller } from './extensionBuildInstaller';
import { DataScienceProductPathService } from './productPath';
import { IExtensionBuildInstaller, INSIDERS_INSTALLER, IProductPathService, STABLE_INSTALLER } from './types';

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<IExtensionBuildInstaller>(
        IExtensionBuildInstaller,
        StableBuildInstaller,
        STABLE_INSTALLER
    );
    serviceManager.addSingleton<IExtensionBuildInstaller>(
        IExtensionBuildInstaller,
        InsidersBuildInstaller,
        INSIDERS_INSTALLER
    );

    serviceManager.addSingleton<IProductPathService>(IProductPathService, DataScienceProductPathService);
    serviceManager.addSingleton<IWebviewPanelProvider>(IWebviewPanelProvider, WebviewPanelProvider);
}
