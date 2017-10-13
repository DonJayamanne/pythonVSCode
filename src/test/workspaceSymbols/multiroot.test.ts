// import * as assert from 'assert';
// import * as path from 'path';
// import { CancellationTokenSource, ConfigurationTarget, Uri } from 'vscode';
// import { initialize, closeActiveWindows } from '../initialize';
// import { Generator } from '../../client/workspaceSymbols/generator';
// import { MockOutputChannel } from '../mockClasses';
// import { WorkspaceSymbolProvider } from '../../client/workspaceSymbols/provider';
// import { enableDisableWorkspaceSymbols } from './common';
// import { PythonSettings } from '../../client/common/configSettings';

// const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'multiRootWkspc');

// suite('Multiroot Workspace Symbols', () => {
//     suiteSetup(() => initialize());
//     setup(() => PythonSettings.dispose());
//     suiteTeardown(() => closeActiveWindows());
//     teardown(async () => {
//         await closeActiveWindows();
//         await enableDisableWorkspaceSymbols(Uri.file(path.join(multirootPath, 'parent', 'child')), false, ConfigurationTarget.WorkspaceFolder);
//         await enableDisableWorkspaceSymbols(Uri.file(path.join(multirootPath, 'workspace2')), false, ConfigurationTarget.WorkspaceFolder);
//     });

//     test(`symbols should be returned when enabeld and vice versa`, async () => {
//         const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
//         const outputChannel = new MockOutputChannel('Output');

//         await enableDisableWorkspaceSymbols(childWorkspaceUri, false, ConfigurationTarget.WorkspaceFolder);

//         let generator = new Generator(childWorkspaceUri, outputChannel);
//         let provider = new WorkspaceSymbolProvider([generator], outputChannel);
//         let symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
//         assert.equal(symbols.length, 0, 'Symbols returned even when workspace symbols are turned off');
//         generator.dispose();

//         await enableDisableWorkspaceSymbols(childWorkspaceUri, true, ConfigurationTarget.WorkspaceFolder);

//         generator = new Generator(childWorkspaceUri, outputChannel);
//         provider = new WorkspaceSymbolProvider([generator], outputChannel);
//         symbols = await provider.provideWorkspaceSymbols('', new CancellationTokenSource().token);
//         assert.notEqual(symbols.length, 0, 'Symbols should be returned when workspace symbols are turned on');
//     });
//     test(`symbols should be filtered correctly`, async () => {
//         const childWorkspaceUri = Uri.file(path.join(multirootPath, 'parent', 'child'));
//         const workspace2Uri = Uri.file(path.join(multirootPath, 'workspace2'));
//         const outputChannel = new MockOutputChannel('Output');

//         await enableDisableWorkspaceSymbols(childWorkspaceUri, true, ConfigurationTarget.WorkspaceFolder);
//         await enableDisableWorkspaceSymbols(workspace2Uri, true, ConfigurationTarget.WorkspaceFolder);

//         const generators = [
//             new Generator(childWorkspaceUri, outputChannel),
//             new Generator(workspace2Uri, outputChannel)];
//         const provider = new WorkspaceSymbolProvider(generators, outputChannel);
//         const symbols = await provider.provideWorkspaceSymbols('meth1Of', new CancellationTokenSource().token);

//         assert.equal(symbols.length, 2, 'Incorrect number of symbols returned');
//         assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('childFile.py')), -1, 'File with symbol not found in child workspace folder');
//         assert.notEqual(symbols.findIndex(sym => sym.location.uri.fsPath.endsWith('workspace2File.py')), -1, 'File with symbol not found in child workspace folder');
//     });
// });
