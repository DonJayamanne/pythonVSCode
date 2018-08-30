// tslint:disable:interface-name no-any max-func-body-length estrict-plus-operands no-empty

import * as assert from 'assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { commands, Position, Range, Selection, TextEditorCursorStyle, TextEditorLineNumbersStyle, TextEditorOptions, Uri, window, workspace } from 'vscode';
import { PythonSettings } from '../../client/common/configSettings';
import { getTextEditsFromPatch } from '../../client/common/editor';
import { extractVariable } from '../../client/providers/simpleRefactorProvider';
import { RefactorProxy } from '../../client/refactor/proxy';
import { PythonVersionInformation } from '../../client/unittests/common/types';
import { rootWorkspaceUri } from '../common';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';
import { closeActiveWindows, initialize, initializeTest, IS_CI_SERVER } from './../initialize';
import { MockOutputChannel } from './../mockClasses';

const EXTENSION_DIR = path.join(__dirname, '..', '..', '..');
const refactorSourceFile = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'refactoring', 'standAlone', 'refactor.py');
const refactorTargetFileDir = path.join(__dirname, '..', '..', '..', 'out', 'test', 'pythonFiles', 'refactoring', 'standAlone');

interface RenameResponse {
    results: [{ diff: string }];
}

suite('Variable Extraction', () => {
    // Hack hac hack
    const oldExecuteCommand = commands.executeCommand;
    const options: TextEditorOptions = { cursorStyle: TextEditorCursorStyle.Line, insertSpaces: true, lineNumbers: TextEditorLineNumbersStyle.Off, tabSize: 4 };
    let refactorTargetFile = '';
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    suiteTeardown(() => {
        commands.executeCommand = oldExecuteCommand;
        return closeActiveWindows();
    });
    setup(async () => {
        initializeDI();
        refactorTargetFile = path.join(refactorTargetFileDir, `refactor${new Date().getTime()}.py`);
        fs.copySync(refactorSourceFile, refactorTargetFile, { overwrite: true });
        await initializeTest();
        (<any>commands).executeCommand = (cmd) => Promise.resolve();
    });
    teardown(async () => {
        commands.executeCommand = oldExecuteCommand;
        try {
            await fs.unlink(refactorTargetFile);
        } catch { }
        await closeActiveWindows();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
    }

    async function testingVariableExtraction(shouldError: boolean, startPos: Position, endPos: Position): Promise<void> {
        const pythonSettings = PythonSettings.getInstance(Uri.file(refactorTargetFile));
        const rangeOfTextToExtract = new Range(startPos, endPos);
        const proxy = new RefactorProxy(EXTENSION_DIR, pythonSettings, path.dirname(refactorTargetFile), ioc.serviceContainer);

        const DIFF = '--- a/refactor.py\n+++ b/refactor.py\n@@ -232,7 +232,8 @@\n         sys.stdout.flush()\n \n     def watch(self):\n-        self._write_response("STARTED")\n+        myNewVariable = "STARTED"\n+        self._write_response(myNewVariable)\n         while True:\n             try:\n                 self._process_request(self._input.readline())\n';
        const mockTextDoc = await workspace.openTextDocument(refactorTargetFile);
        const expectedTextEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
        try {
            const response = await proxy.extractVariable<RenameResponse>(mockTextDoc, 'myNewVariable', refactorTargetFile, rangeOfTextToExtract, options);
            if (shouldError) {
                assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
            }
            const textEdits = getTextEditsFromPatch(mockTextDoc.getText(), DIFF);
            assert.equal(response.results.length, 1, 'Invalid number of items in response');
            assert.equal(textEdits.length, expectedTextEdits.length, 'Invalid number of Text Edits');
            textEdits.forEach(edit => {
                const foundEdit = expectedTextEdits.filter(item => item.newText === edit.newText && item.range.isEqual(edit.range));
                assert.equal(foundEdit.length, 1, 'Edit not found');
            });
        } catch (error) {
            if (!shouldError) {
                assert.equal('Error', 'No error', `${error}`);
            }
        }
    }

    // tslint:disable-next-line:no-function-expression
    test('Extract Variable', async function () {
        const pyVersion: PythonVersionInformation = await ioc.getPythonMajorMinorVersion(rootWorkspaceUri);

        if (pyVersion.major === 3 && pyVersion.minor === 7) {
            // tslint:disable-next-line:no-invalid-this
            return this.skip();
        } else {
            const startPos = new Position(234, 29);
            const endPos = new Position(234, 38);
            await testingVariableExtraction(false, startPos, endPos);
        }
    });

    test('Extract Variable fails if whole string not selected', async () => {
        const startPos = new Position(234, 20);
        const endPos = new Position(234, 38);
        await testingVariableExtraction(true, startPos, endPos);
    });

    async function testingVariableExtractionEndToEnd(shouldError: boolean, startPos: Position, endPos: Position): Promise<void> {
        const ch = new MockOutputChannel('Python');
        const rangeOfTextToExtract = new Range(startPos, endPos);

        const textDocument = await workspace.openTextDocument(refactorTargetFile);
        const editor = await window.showTextDocument(textDocument);

        editor.selections = [new Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end)];
        editor.selection = new Selection(rangeOfTextToExtract.start, rangeOfTextToExtract.end);
        try {
            await extractVariable(EXTENSION_DIR, editor, rangeOfTextToExtract, ch, ioc.serviceContainer);
            if (shouldError) {
                assert.fail('No error', 'Error', 'Extraction should fail with an error', '');
            }
            assert.equal(ch.output.length, 0, 'Output channel is not empty');

            const newVarDefLine = textDocument.lineAt(editor.selection.start);
            const newVarRefLine = textDocument.lineAt(newVarDefLine.lineNumber + 1);

            assert.equal(newVarDefLine.text.trim().indexOf('newvariable'), 0, 'New Variable not created');
            assert.equal(newVarDefLine.text.trim().endsWith('= "STARTED"'), true, 'Started Text Assigned to variable');
            assert.equal(newVarRefLine.text.indexOf('(newvariable') >= 0, true, 'New Variable not being used');
        } catch (error) {
            if (!shouldError) {
                assert.fail('Error', 'No error', `${error}`);
            }
        }
    }

    // This test fails on linux (text document not getting updated in time)
    if (!IS_CI_SERVER) {
        test('Extract Variable (end to end)', async () => {
            const startPos = new Position(234, 29);
            const endPos = new Position(234, 38);
            await testingVariableExtractionEndToEnd(false, startPos, endPos);
        });
    }

    test('Extract Variable fails if whole string not selected (end to end)', async () => {
        const startPos = new Position(234, 20);
        const endPos = new Position(234, 38);
        await testingVariableExtractionEndToEnd(true, startPos, endPos);
    });
});
