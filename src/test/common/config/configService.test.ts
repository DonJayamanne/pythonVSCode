import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../../client/common/configSettings';
import { createDeferred } from '../../../client/common/helpers';
import { IConfigurationService } from '../../../client/common/types';
import { clearPythonPathInWorkspaceFolder } from '../../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../../initialize';
import { UnitTestIocContainer } from '../../unittests/serviceRegistry';

const multirootPath = path.join(__dirname, '..', '..', '..', '..', 'src', 'testMultiRootWkspc');

// tslint:disable-next-line:max-func-body-length
suite('Config Service', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(() => {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
        return initializeTest();
    });
    suiteTeardown(closeActiveWindows);
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
        await initializeTest();
        if (IS_MULTI_ROOT_TEST) {
            await clearPythonPathInWorkspaceFolder(Uri.file(path.join(multirootPath, 'workspace1')));
        }
    });

    async function enableDisableLinterSetting(resource: Uri, configTarget: ConfigurationTarget, setting: string, enabled: boolean | undefined): Promise<void> {
        const settings = workspace.getConfiguration('python.linting', resource);
        const cfgValue = settings.inspect<boolean>(setting);
        if (configTarget === ConfigurationTarget.Workspace && cfgValue && cfgValue.workspaceValue === enabled) {
            return;
        }
        if (configTarget === ConfigurationTarget.WorkspaceFolder && cfgValue && cfgValue.workspaceFolderValue === enabled) {
            return;
        }
        await settings.update(setting, enabled, configTarget);
    }

    test('Same instance of PythonSettings will be returned when workspace uri is provied', async () => {
        const workspaceUri = workspace.workspaceFolders![0].uri;
        const pythonSettings = PythonSettings.getInstance(workspaceUri);
        const pythonSettingsFromService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService).getConfiguration(workspaceUri);
        assert.equal(pythonSettingsFromService === pythonSettingsFromService, true, 'Instance of PythonSettings returned are not the same');
    });

    test('Same instance of PythonSettings will be returned when a workspace uri is not provided', async () => {
        const pythonSettings = PythonSettings.getInstance();
        const pythonSettingsFromService = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService).getConfiguration();
        assert.equal(pythonSettingsFromService === pythonSettingsFromService, true, 'Instance of PythonSettings returned are not the same');
    });

    test('Change event should be fired when config changes are made', async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
            return;
        }
        const settingsChanged = createDeferred<boolean>();
        const pythonSettings = ioc.serviceContainer.get<IConfigurationService>(IConfigurationService).getConfiguration();

        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', undefined);

        await new Promise(resolve => setTimeout(resolve, 2000));

        pythonSettings.onChange(() => settingsChanged.resolve(true));
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await enableDisableLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);

        const changed = await settingsChanged.promise;
        assert.equal(changed, true, 'Changed promise not resolved to true');
        assert.equal(pythonSettings.linting.pylintEnabled, false, 'Pylint not enabled when it should be');
    });
});
