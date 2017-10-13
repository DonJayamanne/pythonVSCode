import * as assert from 'assert';
import * as path from 'path';
import { CancellationTokenSource, ConfigurationTarget, Uri } from 'vscode';
import { initialize, closeActiveWindows } from '../initialize';
import { Generator } from '../../client/workspaceSymbols/generator';
import { MockOutputChannel } from '../mockClasses';
import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
import { enableDisableWorkspaceSymbols } from './common';
import { PythonSettings } from '../../client/common/configSettings';

const workspaceUri = Uri.file(path.join(__dirname, '..', '..', '..', 'src', 'test'));

suite('Workspace Symbols', () => {
    suiteSetup(() => initialize());
    suiteTeardown(() => closeActiveWindows());
    setup(() => PythonSettings.dispose());
    teardown(async () => {
        await closeActiveWindows();
        await enableDisableWorkspaceSymbols(workspaceUri, false, ConfigurationTarget.Workspace);
    });

    test(`symbols should be returned when enabeld and vice versa`, async () => {
        const outputChannel = new MockOutputChannel('Output');
        await enableDisableWorkspaceSymbols(workspaceUri, false, ConfigurationTarget.Workspace);

        // The workspace will be in the output test folder
        // So lets modify the settings so it sees the source test folder
        const settings = PythonSettings.getInstance(workspaceUri);
        settings.workspaceSymbols.tagFilePath = path.join(workspaceUri.fsPath, '.vscode', 'tags')

        let generator = new Generator(workspaceUri, outputChannel);
        let provider = new WorkspaceSymbolProvider([generator], outputChannel);
        let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
        generator.dispose();

        await enableDisableWorkspaceSymbols(workspaceUri, true, ConfigurationTarget.Workspace);

        generator = new Generator(workspaceUri, outputChannel);
        provider = new WorkspaceSymbolProvider([generator], outputChannel);
        symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
        assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
    });
    test(`symbols should be filtered correctly`, async () => {
        const outputChannel = new MockOutputChannel('Output');
        await enableDisableWorkspaceSymbols(workspaceUri, true, ConfigurationTarget.Workspace);

        const generators = [new Generator(workspaceUri, outputChannel)];
        const provider = new WorkspaceSymbolProvider(generators, outputChannel);
        const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

        assert.equal(symbols.length >= 2, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
        assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');

        const symbolsForMeth = await provider.provideWorkspaceSymbols('meth', new CancellationTokenSource().token);
        assert.equal(symbolsForMeth.length >= 10, true, 'Incorrect number of symbols returned');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'Symbols not returned for childFile.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'Symbols not returned for workspace2File.py');
        assert.notEqual(symbolsForMeth.findIndex(sym => sym.location.uri.fsPath.endsWith('file.py')), -1, 'Symbols not returned for file.py');
    });
});
