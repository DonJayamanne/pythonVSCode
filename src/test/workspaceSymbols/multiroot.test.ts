import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri, workspace } from 'vscode';
import { initialize, closeActiveWindows } from '../initialize';
import { PythonSettings } from '../../client/common/configSettings';
import { Generator } from '../../client/workspaceSymbols/generator';
import { MockOutputChannel } from '../mockClasses';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
import { enableDisableWorkspaceSymbols } from './common';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'multiRootWkspc');

suite('Multiroot Workspace Symbols', () => {
    suiteSetup(() => initialize());
    suiteTeardown(() => closeActiveWindows());
    teardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });

    async function resetSettings() {
        PythonSettings.dispose();
        const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
        const settings = workspace.getConfiguration('python', childWorkspaceUri);
        const value = settings.inspect('workspaceSymbols.enabled');
        if (value.workspaceFolderValue !== false) {
            await settings.update('workspaceSymbols.enabled', false, ConfigurationTarget.WorkspaceFolder);
        }
    }
    test(`symbols should be returned when enabeld and vice versa`, async () => {
        const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
        const outputChannel = new MockOutputChannel('Output');

        await enableDisableWorkspaceSymbols(childWorkspaceUri, false);

        let generator = new Generator(childWorkspaceUri, outputChannel);
        let provider = new WorkspaceSymbolProvider([generator], outputChannel);
        let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();

        await enableDisableWorkspaceSymbols(childWorkspaceUri, true);

        generator = new Generator(childWorkspaceUri, outputChannel);
        provider = new WorkspaceSymbolProvider([generator], outputChannel);
        symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    });
    test(`symbols should be filtered correctly`, async () => {
        const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
        const workspace2Uri = Uri.file(path.join(multirootPath, 'workspace2'));
        const outputChannel = new MockOutputChannel('Output');

        await enableDisableWorkspaceSymbols(childWorkspaceUri, true);
        await enableDisableWorkspaceSymbols(workspace2Uri, true);

        const generators = [
            new Generator(childWorkspaceUri, outputChannel),
            new Generator(workspace2Uri, outputChannel)];
        const provider = new WorkspaceSymbolProvider(generators, outputChannel);
        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        // Remember (multiroot workspace is a child directory, hence we have more python files to account for in there)
        assert.equal(symbols.length >= 2, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');
    });
});
