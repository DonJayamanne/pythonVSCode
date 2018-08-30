import * as assert from 'assert';
import * as fs from 'fs';
import { EOL } from 'os';
import * as path from 'path';
import { commands, ConfigurationTarget, Position, Range, Uri, window, workspace } from 'vscode';
import { PythonImportSortProvider } from '../../client/providers/importSortProvider';
import { updateSetting } from '../common';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

const sortingPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'sorting');
const fileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'before.py');
const originalFileToFormatWithoutConfig = path.join(sortingPath, 'noconfig', 'original.py');
const fileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'before.py');
const originalFileToFormatWithConfig = path.join(sortingPath, 'withconfig', 'original.py');
const fileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'before.1.py');
const originalFileToFormatWithConfig1 = path.join(sortingPath, 'withconfig', 'original.1.py');
const extensionDir = path.join(__dirname, '..', '..', '..');

// tslint:disable-next-line:max-func-body-length
suite('Sorting', () => {
    let ioc: UnitTestIocContainer;
    let sorter: PythonImportSortProvider;
    const configTarget = IS_MULTI_ROOT_TEST ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Workspace;
    suiteSetup(initialize);
    suiteTeardown(async () => {
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        await updateSetting('sortImports.args', [], Uri.file(sortingPath), configTarget);
        await closeActiveWindows();
    });
    setup(async () => {
        await initializeTest();
        initializeDI();
        fs.writeFileSync(fileToFormatWithConfig, fs.readFileSync(originalFileToFormatWithConfig));
        fs.writeFileSync(fileToFormatWithoutConfig, fs.readFileSync(originalFileToFormatWithoutConfig));
        fs.writeFileSync(fileToFormatWithConfig1, fs.readFileSync(originalFileToFormatWithConfig1));
        await updateSetting('sortImports.args', [], Uri.file(sortingPath), configTarget);
        await closeActiveWindows();
        sorter = new PythonImportSortProvider(ioc.serviceContainer);
    });
    teardown(async () => {
        ioc.dispose();
        await closeActiveWindows();
    });
    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerVariableTypes();
        ioc.registerProcessTypes();
    }
    test('Without Config', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithoutConfig);
        await window.showTextDocument(textDocument);
        const edits = await sorter.sortImports(extensionDir, textDocument);
        assert.equal(edits.filter(value => value.newText === EOL && value.range.isEqual(new Range(2, 0, 2, 0))).length, 1, 'EOL not found');
        assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new Range(3, 0, 4, 0))).length, 1, '"" not found');
        assert.equal(edits.filter(value => value.newText === `from rope.base import libutils${EOL}from rope.refactor.extract import ExtractMethod, ExtractVariable${EOL}from rope.refactor.rename import Rename${EOL}` && value.range.isEqual(new Range(6, 0, 6, 0))).length, 1, 'Text not found');
        assert.equal(edits.filter(value => value.newText === '' && value.range.isEqual(new Range(13, 0, 18, 0))).length, 1, '"" not found');
    });

    test('Without Config (via Command)', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithoutConfig);
        const originalContent = textDocument.getText();
        await window.showTextDocument(textDocument);
        await commands.executeCommand('python.sortImports');
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });

    test('With Config', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        await window.showTextDocument(textDocument);
        const edits = await sorter.sortImports(extensionDir, textDocument);
        const newValue = `from third_party import lib2${EOL}from third_party import lib3${EOL}from third_party import lib4${EOL}from third_party import lib5${EOL}from third_party import lib6${EOL}from third_party import lib7${EOL}from third_party import lib8${EOL}from third_party import lib9${EOL}`;
        assert.equal(edits.filter(value => value.newText === newValue && value.range.isEqual(new Range(0, 0, 3, 0))).length, 1, 'New Text not found');
    });

    test('With Config (via Command)', async () => {
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const originalContent = textDocument.getText();
        await window.showTextDocument(textDocument);
        await commands.executeCommand('python.sortImports');
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });

    test('With Changes and Config in Args', async () => {
        await updateSetting('sortImports.args', ['-sp', path.join(sortingPath, 'withconfig')], Uri.file(sortingPath), ConfigurationTarget.Workspace);
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const editor = await window.showTextDocument(textDocument);
        await editor.edit(builder => {
            builder.insert(new Position(0, 0), `from third_party import lib0${EOL}`);
        });
        const edits = await sorter.sortImports(extensionDir, textDocument);
        assert.notEqual(edits.length, 0, 'No edits');
    });
    test('With Changes and Config in Args (via Command)', async () => {
        await updateSetting('sortImports.args', ['-sp', path.join(sortingPath, 'withconfig')], Uri.file(sortingPath), configTarget);
        const textDocument = await workspace.openTextDocument(fileToFormatWithConfig);
        const editor = await window.showTextDocument(textDocument);
        await editor.edit(builder => {
            builder.insert(new Position(0, 0), `from third_party import lib0${EOL}`);
        });
        const originalContent = textDocument.getText();
        await commands.executeCommand('python.sortImports');
        assert.notEqual(originalContent, textDocument.getText(), 'Contents have not changed');
    });
});
