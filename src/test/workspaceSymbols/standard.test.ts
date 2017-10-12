import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri, workspace } from 'vscode';
import { initialize, closeActiveWindows } from '../initialize';
import { PythonSettings } from '../../client/common/configSettings';
import { Generator } from '../../client/workspaceSymbols/generator';
import { MockOutputChannel } from '../mockClasses';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
import { enableDisableWorkspaceSymbols } from './common';

const symbolFilesPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'symbolFiles');

suite('Workspace Symbols', () => {
    suiteSetup(() => initialize());
    suiteTeardown(() => closeActiveWindows());
    teardown(async () => {
        await closeActiveWindows();
        await resetSettings();
    });

    async function resetSettings() {
        PythonSettings.dispose();
        const workspaceUri = Uri.file(path.join(symbolFilesPath, 'file.py'));
        const settings = workspace.getConfiguration('python', workspaceUri);
        const value = settings.inspect('workspaceSymbols.enabled');
        if (value.workspaceFolderValue !== true) {
            await settings.update('workspaceSymbols.enabled', true, ConfigurationTarget.Workspace);
        }
    }
    test(`symbols should be returned when enabeld and vice versa`, async () => {
        const workspaceUri = Uri.file(path.join(symbolFilesPath, 'file.py'));
        const outputChannel = new MockOutputChannel('Output');

        await enableDisableWorkspaceSymbols(workspaceUri, false);

        let generator = new Generator(workspaceUri, outputChannel);
        let provider = new WorkspaceSymbolProvider([generator], outputChannel);
        let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();

        await enableDisableWorkspaceSymbols(workspaceUri, true);

        generator = new Generator(workspaceUri, outputChannel);
        provider = new WorkspaceSymbolProvider([generator], outputChannel);
        symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    });
    test(`symbols should be filtered correctly`, async () => {
        const workspaceUri = Uri.file(path.join(symbolFilesPath, 'file.py'));
        const outputChannel = new MockOutputChannel('Output');

        await enableDisableWorkspaceSymbols(workspaceUri, true);

        const generators = [new Generator(workspaceUri, outputChannel)];
        const provider = new WorkspaceSymbolProvider(generators, outputChannel);
        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        assert.equal(symbols.length, 2, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');

        const symbolsForMeth = await provider.provideWorkspaceSymbols('meth', new CancellationTokenSource().token);
        assert.equal(symbolsForMeth.length, 10, 'Incorrect number of symbols returned');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'Symbols not returned for childFile.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'Symbols not returned for workspace2File.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('file.py')), -1, 'Symbols not returned for file.py');
    });
});
