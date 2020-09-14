// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Uri } from 'vscode';

import { IProcessServiceFactory } from '../../client/common/process/types';
import { CodeCssGenerator } from '../../client/datascience/codeCssGenerator';
import { InteractiveWindow } from '../../client/datascience/interactive-window/interactiveWindow';
import { InteractiveWindowProvider } from '../../client/datascience/interactive-window/interactiveWindowProvider';
import { JupyterExecutionFactory } from '../../client/datascience/jupyter/jupyterExecutionFactory';
import { JupyterImporter } from '../../client/datascience/jupyter/jupyterImporter';
import { JupyterServerWrapper } from '../../client/datascience/jupyter/jupyterServerWrapper';
import {
    ICodeCssGenerator,
    IInteractiveWindow,
    IInteractiveWindowProvider,
    IJupyterExecution,
    INotebookImporter,
    INotebookServer
} from '../../client/datascience/types';
import { getPythonSemVer } from '../common';
import { IocContainer } from '../serviceRegistry';

export class UnitTestIocContainer extends IocContainer {
    constructor() {
        super();
    }
    public async getPythonMajorVersion(resource: Uri): Promise<number> {
        const procServiceFactory = this.serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
        const procService = await procServiceFactory.create(resource);
        const pythonVersion = await getPythonSemVer(procService);
        if (pythonVersion) {
            return pythonVersion.major;
        } else {
            return -1; // log warning already issued by underlying functions...
        }
    }

    public registerDataScienceTypes() {
        this.serviceManager.addSingleton<IJupyterExecution>(IJupyterExecution, JupyterExecutionFactory);
        this.serviceManager.addSingleton<IInteractiveWindowProvider>(
            IInteractiveWindowProvider,
            InteractiveWindowProvider
        );
        this.serviceManager.add<IInteractiveWindow>(IInteractiveWindow, InteractiveWindow);
        this.serviceManager.add<INotebookImporter>(INotebookImporter, JupyterImporter);
        this.serviceManager.add<INotebookServer>(INotebookServer, JupyterServerWrapper);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);
    }
}
