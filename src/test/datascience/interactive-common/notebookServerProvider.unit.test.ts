// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { SemVer } from 'semver';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../../client/common/application/types';
import { IConfigurationService, IWatchableJupyterSettings } from '../../../client/common/types';
import { NotebookServerProvider } from '../../../client/datascience/interactive-common/notebookServerProvider';
import { JupyterServerSelector } from '../../../client/datascience/jupyter/serverSelector';
import { JupyterServerUriStorage } from '../../../client/datascience/jupyter/serverUriStorage';
import { ProgressReporter } from '../../../client/datascience/progress/progressReporter';
import { IJupyterExecution, INotebookServer } from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { PythonEnvironment } from '../../../client/pythonEnvironments/info';

// tslint:disable:no-any
function createTypeMoq<T>(tag: string): typemoq.IMock<T> {
    // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
    // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
    const result = typemoq.Mock.ofType<T>();
    (result as any).tag = tag;
    result.setup((x: any) => x.then).returns(() => undefined);
    return result;
}

// tslint:disable: max-func-body-length
suite('DataScience - NotebookServerProvider', () => {
    let serverProvider: NotebookServerProvider;
    let progressReporter: ProgressReporter;
    let configurationService: IConfigurationService;
    let jupyterExecution: IJupyterExecution;
    let applicationShell: IApplicationShell;
    let interpreterService: IInterpreterService;
    let pythonSettings: IWatchableJupyterSettings;
    const workingPython: PythonEnvironment = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python'
    };

    setup(() => {
        progressReporter = mock(ProgressReporter);
        configurationService = mock<IConfigurationService>();
        jupyterExecution = mock<IJupyterExecution>();
        applicationShell = mock<IApplicationShell>();
        interpreterService = mock<IInterpreterService>();

        // Set up our settings
        pythonSettings = mock<IWatchableJupyterSettings>();
        when(pythonSettings.jupyterServerType).thenReturn('local');
        when(configurationService.getSettings(anything())).thenReturn(instance(pythonSettings));
        const serverStorage = mock(JupyterServerUriStorage);
        when(serverStorage.getUri()).thenResolve('local');
        const serverSelector = mock(JupyterServerSelector);
        when((jupyterExecution as any).then).thenReturn(undefined);
        when((serverSelector as any).then).thenReturn(undefined);
        when((serverStorage as any).then).thenReturn(undefined);

        // Create the server provider
        serverProvider = new NotebookServerProvider(
            instance(progressReporter),
            instance(configurationService),
            instance(jupyterExecution),
            instance(applicationShell),
            instance(interpreterService),
            instance(serverStorage),
            instance(serverSelector)
        );
    });

    test('NotebookServerProvider - Get Only - no server', async () => {
        when(jupyterExecution.getServer(anything())).thenResolve(undefined);

        const server = await serverProvider.getOrCreateServer({ getOnly: true });
        expect(server).to.equal(undefined, 'Server expected to be undefined');
        verify(jupyterExecution.getServer(anything())).once();
    });

    test('NotebookServerProvider - Get Only - server', async () => {
        const notebookServer = mock<INotebookServer>();
        when((notebookServer as any).then).thenReturn(undefined);
        when(jupyterExecution.getServer(anything())).thenResolve(instance(notebookServer));

        const server = await serverProvider.getOrCreateServer({ getOnly: true });
        expect(server).to.not.equal(undefined, 'Server expected to be defined');
        verify(jupyterExecution.getServer(anything())).once();
    });

    test('NotebookServerProvider - Get Or Create', async () => {
        when(jupyterExecution.getUsableJupyterPython()).thenResolve(workingPython);
        const notebookServer = createTypeMoq<INotebookServer>('jupyter server');
        when(jupyterExecution.connectToNotebookServer(anything(), anything())).thenResolve(notebookServer.object);

        // Disable UI just lets us skip mocking the progress reporter
        const server = await serverProvider.getOrCreateServer({ getOnly: false, disableUI: true });
        expect(server).to.not.equal(undefined, 'Server expected to be defined');
    });
});
