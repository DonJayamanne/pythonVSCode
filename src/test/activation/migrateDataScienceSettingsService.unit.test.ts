import { expect } from 'chai';
import { anyString, instance, mock, when } from 'ts-mockito';
import { MigrateDataScienceSettingsService } from '../../client/activation/migrateDataScienceSettingsService';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import { IApplicationEnvironment, IWorkspaceService } from '../../client/common/application/types';
import { WorkspaceService } from '../../client/common/application/workspace';
import { JupyterServerUriStorage } from '../../client/datascience/jupyter/serverUriStorage';
import { IJupyterServerUriStorage } from '../../client/datascience/types';
import { MockFileSystem } from '../datascience/mockFileSystem';

suite('Migrate data science settings', () => {
    const fs = new MockFileSystem();
    let workspace: IWorkspaceService;
    let application: IApplicationEnvironment;
    let updateDataScienceSettingsService: MigrateDataScienceSettingsService;
    let uriStorage: IJupyterServerUriStorage;
    let uriSet: string | undefined = undefined;
    const FILEPATH = '/path/to/settings.json';
    const originalSettings = `{
        "python.dataScience.allowImportFromNotebook": true,
        "python.dataScience.alwaysTrustNotebooks": true,
        "python.dataScience.enabled": true,
        "python.dataScience.jupyterInterruptTimeout": 0,
        "python.dataScience.jupyterLaunchTimeout": 0,
        "python.dataScience.jupyterLaunchRetries": 0,
        "python.dataScience.jupyterServerURI": "foo",
        "python.dataScience.notebookFileRoot": "foo",
        "python.dataScience.changeDirOnImportExport": true,
        "python.dataScience.useDefaultConfigForJupyter": true,
        "python.dataScience.searchForJupyter": true,
        "python.dataScience.allowInput": true,
        "python.dataScience.showCellInputCode": true,
        "python.dataScience.collapseCellInputCodeByDefault": true,
        "python.dataScience.maxOutputSize": 0,
        "python.dataScience.enableScrollingForCellOutputs": true,
        "python.dataScience.sendSelectionToInteractiveWindow": true,
        "python.dataScience.markdownRegularExpression": "foo",
        "python.dataScience.codeRegularExpression": "foo",
        "python.dataScience.allowLiveShare": true,
        "python.dataScience.errorBackgroundColor": "foo",
        "python.dataScience.ignoreVscodeTheme": true,
        "python.dataScience.variableExplorerExclude": "foo",
        "python.dataScience.liveShareConnectionTimeout": 0,
        "python.dataScience.decorateCells": true,
        "python.dataScience.enableCellCodeLens": true,
        "python.dataScience.askForLargeDataFrames": true,
        "python.dataScience.enableAutoMoveToNextCell": true,
        "python.dataScience.allowUnauthorizedRemoteConnection": true,
        "python.dataScience.askForKernelRestart": true,
        "python.dataScience.enablePlotViewer": true,
        "python.dataScience.codeLenses": "foo",
        "python.dataScience.debugCodeLenses": "foo",
        "python.dataScience.debugpyDistPath": "foo",
        "python.dataScience.stopOnFirstLineWhileDebugging": true,
        "python.dataScience.textOutputLimit": 0,
        "python.dataScience.magicCommandsAsComments": true,
        "python.dataScience.stopOnError": true,
        "python.dataScience.remoteDebuggerPort": 0,
        "python.dataScience.colorizeInputBox": true,
        "python.dataScience.addGotoCodeLenses": true,
        "python.dataScience.useNotebookEditor": true,
        "python.dataScience.runMagicCommands": "foo",
        "python.dataScience.runStartupCommands": ["foo", "bar"],
        "python.dataScience.debugJustMyCode": true,
        "python.dataScience.defaultCellMarker": "foo",
        "python.dataScience.verboseLogging": true,
        "python.dataScience.themeMatplotlibPlots": true,
        "python.dataScience.useWebViewServer": true,
        "python.dataScience.variableQueries": ["foo", "bar"],
        "python.dataScience.disableJupyterAutoStart": true,
        "python.dataScience.jupyterCommandLineArguments": ["foo", "bar"],
        "python.dataScience.alwaysScrollOnNewCell": true,
        "python.dataScience.showKernelSelectionOnInteractiveWindow": true,
        "python.languageServer": "Pylance",
        "python.linting.enabled": false,
        "python.experiments.optOutFrom": [
            "DeprecatePythonPath - experiment"
        ],
    }`;
    const migratedSettings = `{
        "jupyter.allowImportFromNotebook": true,
        "jupyter.alwaysTrustNotebooks": true,
        "jupyter.enabled": true,
        "jupyter.jupyterInterruptTimeout": 0,
        "jupyter.jupyterLaunchTimeout": 0,
        "jupyter.jupyterLaunchRetries": 0,
        "jupyter.notebookFileRoot": "foo",
        "jupyter.changeDirOnImportExport": true,
        "jupyter.useDefaultConfigForJupyter": true,
        "jupyter.searchForJupyter": true,
        "jupyter.allowInput": true,
        "jupyter.showCellInputCode": true,
        "jupyter.collapseCellInputCodeByDefault": true,
        "jupyter.maxOutputSize": 0,
        "jupyter.enableScrollingForCellOutputs": true,
        "jupyter.sendSelectionToInteractiveWindow": true,
        "jupyter.markdownRegularExpression": "foo",
        "jupyter.codeRegularExpression": "foo",
        "jupyter.allowLiveShare": true,
        "jupyter.errorBackgroundColor": "foo",
        "jupyter.ignoreVscodeTheme": true,
        "jupyter.variableExplorerExclude": "foo",
        "jupyter.liveShareConnectionTimeout": 0,
        "jupyter.decorateCells": true,
        "jupyter.enableCellCodeLens": true,
        "jupyter.askForLargeDataFrames": true,
        "jupyter.enableAutoMoveToNextCell": true,
        "jupyter.allowUnauthorizedRemoteConnection": true,
        "jupyter.askForKernelRestart": true,
        "jupyter.enablePlotViewer": true,
        "jupyter.codeLenses": "foo",
        "jupyter.debugCodeLenses": "foo",
        "jupyter.debugpyDistPath": "foo",
        "jupyter.stopOnFirstLineWhileDebugging": true,
        "jupyter.textOutputLimit": 0,
        "jupyter.magicCommandsAsComments": true,
        "jupyter.stopOnError": true,
        "jupyter.remoteDebuggerPort": 0,
        "jupyter.colorizeInputBox": true,
        "jupyter.addGotoCodeLenses": true,
        "jupyter.useNotebookEditor": true,
        "jupyter.runMagicCommands": "foo",
        "jupyter.runStartupCommands": ["foo", "bar"],
        "jupyter.debugJustMyCode": true,
        "jupyter.defaultCellMarker": "foo",
        "jupyter.verboseLogging": true,
        "jupyter.themeMatplotlibPlots": true,
        "jupyter.useWebViewServer": true,
        "jupyter.variableQueries": ["foo", "bar"],
        "jupyter.disableJupyterAutoStart": true,
        "jupyter.jupyterCommandLineArguments": ["foo", "bar"],
        "jupyter.alwaysScrollOnNewCell": true,
        "jupyter.showKernelSelectionOnInteractiveWindow": true,
        "python.languageServer": "Pylance",
        "python.linting.enabled": false,
        "python.experiments.optOutFrom": [
            "DeprecatePythonPath - experiment"
        ],
    }`;

    setup(() => {
        fs.addFileContents(FILEPATH, originalSettings);
        application = mock(ApplicationEnvironment);
        workspace = mock(WorkspaceService);
        uriStorage = mock(JupyterServerUriStorage);
        when(uriStorage.setUri(anyString())).thenCall((a) => {
            uriSet = a;
            return Promise.resolve();
        });
        updateDataScienceSettingsService = new MigrateDataScienceSettingsService(
            fs,
            application,
            workspace,
            instance(uriStorage)
        );
    });

    test('Correctly updates python.dataScience settings', async () => {
        const result = await updateDataScienceSettingsService.fixSettingInFile(FILEPATH);
        expect(result === migratedSettings, 'Failed to migrate python.dataScience settings');
        expect(uriSet === 'foo', 'Uri was not ported');
    });
});
