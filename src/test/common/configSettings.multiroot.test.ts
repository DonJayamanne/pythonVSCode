import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { initialize, closeActiveWindows } from '../initialize';
import { PythonSettings } from '../../client/common/configSettings';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'multiRootWkspc');

suite('Multiroot Config Settings', () => {
    suiteSetup(async () => {
        await initialize();
        await resetSettings();
    });
    suiteTeardown(() => closeActiveWindows());
    teardown(async () => {
        await resetSettings();
        // await closeActiveWindows();
    });

    async function resetSettings() {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        let settings = workspace.getConfiguration('python', workspaceUri);
        let value = settings.inspect('pythonPath');
        if (value.workspaceValue && value.workspaceValue !== 'python') {
            await settings.update('pythonPath', undefined, ConfigurationTarget.Workspace);
        }
        if (value.workspaceFolderValue && value.workspaceFolderValue !== 'python') {
            await settings.update('pythonPath', undefined, ConfigurationTarget.WorkspaceFolder);
        }
        PythonSettings.dispose();
    }
    async function enableDisableSetting(resource: Uri, configTarget: ConfigurationTarget, setting: string, value: boolean) {
        let settings = workspace.getConfiguration('python.linting', resource);
        await settings.update(setting, value, configTarget);
        settings = workspace.getConfiguration('python.linting', resource);
        return settings.get<boolean>(setting);
    }

    async function testLinterSetting(resource: Uri, configTarget: ConfigurationTarget, setting: string, value: boolean) {
        const valueInSetting = await enableDisableSetting(resource, configTarget, setting, value);
        PythonSettings.dispose();
        const cfgSetting = PythonSettings.getInstance(resource);
        assert.equal(valueInSetting, cfgSetting.linting[setting], `Both settings ${setting} should be ${value} for ${resource.fsPath}`);
    }

    test('Workspace folder should inherit Python Path from workspace root', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        let settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);

        settings = workspace.getConfiguration('python', workspaceUri);
        assert.equal(settings.get('pythonPath'), pythonPath, 'Python path not set in workspace root');

        const cfgSetting = PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    });

    test('Workspace folder should not inherit Python Path from workspace root', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        let settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        await settings.update('pythonPath', 'privatePythonPath', ConfigurationTarget.WorkspaceFolder);

        const cfgSetting = PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.pythonPath, 'privatePythonPath', 'Python Path for workspace folder is incorrect');
    });


    test('Workspace folder should inherit Python Path from workspace root when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        const settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);

        const document = await workspace.openTextDocument(fileToOpen);
        const cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.pythonPath, pythonPath, 'Python Path not inherited from workspace');
    });

    test('Workspace folder should not inherit Python Path from workspace root when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        const settings = workspace.getConfiguration('python', workspaceUri);
        const pythonPath = `x${new Date().getTime()}`;
        await settings.update('pythonPath', pythonPath, ConfigurationTarget.Workspace);
        await settings.update('pythonPath', 'privatePythonPath', ConfigurationTarget.WorkspaceFolder);

        const document = await workspace.openTextDocument(fileToOpen);
        const cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.pythonPath, 'privatePythonPath', 'Python Path for workspace folder is incorrect');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
    });

    test('Enabling/Disabling Pylint in root and workspace should be reflected in config settings', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const workspaceFolder = Uri.file(path.join(multirootPath, 'workspace1'));

        await testLinterSetting(workspaceFolder, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);

        let cfgSetting = PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, false, 'Workspace folder pylint setting is true when it should not be');
        PythonSettings.dispose();

        await testLinterSetting(workspaceFolder, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);

        cfgSetting = PythonSettings.getInstance(workspaceUri);
        assert.equal(cfgSetting.linting.pylintEnabled, true, 'Workspace folder pylint setting is false when it should not be');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await testLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        PythonSettings.dispose();

        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await testLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = await workspace.openTextDocument(fileToOpen);
        cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    });

    test('Enabling/Disabling Pylint in root should be reflected in config settings when opening a document', async () => {
        const workspaceUri = Uri.file(path.join(multirootPath, 'workspace1'));
        const fileToOpen = path.join(multirootPath, 'workspace1', 'file.py');

        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', false);
        await testLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', true);
        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, true, 'Pylint should be enabled in workspace');
        PythonSettings.dispose();

        await testLinterSetting(workspaceUri, ConfigurationTarget.Workspace, 'pylintEnabled', true);
        await testLinterSetting(workspaceUri, ConfigurationTarget.WorkspaceFolder, 'pylintEnabled', false);
        document = await workspace.openTextDocument(fileToOpen);
        cfg = PythonSettings.getInstance(document.uri);
        assert.equal(cfg.linting.pylintEnabled, false, 'Pylint should not be enabled in workspace');
    });

    test('${workspaceRoot} variable in settings should be replaced with the right value', async () => {
        const workspace2Uri = Uri.file(path.join(multirootPath, 'workspace2'));
        let fileToOpen = path.join(workspace2Uri.fsPath, 'file.py');

        let document = await workspace.openTextDocument(fileToOpen);
        let cfg = PythonSettings.getInstance(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.ctagsPath), workspace2Uri.fsPath, 'ctags file for workspace2 is incorrect');
        PythonSettings.dispose();

        const workspace3Uri = Uri.file(path.join(multirootPath, 'workspace2'));
        fileToOpen = path.join(workspace3Uri.fsPath, 'file.py');

        document = await workspace.openTextDocument(fileToOpen);
        cfg = PythonSettings.getInstance(document.uri);
        assert.equal(path.dirname(cfg.workspaceSymbols.ctagsPath), workspace3Uri.fsPath, 'ctags file for workspace3 is incorrect');
        PythonSettings.dispose();
    });
});
