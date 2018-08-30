// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import '../../client/common/extensions';
import { IS_ANALYSIS_ENGINE_TEST } from '../constants';
import { closeActiveWindows, initialize, initializeTest } from '../initialize';
import { normalizeMarkedString } from '../textUtils';

const autoCompPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'autocomp');
const hoverPath = path.join(__dirname, '..', '..', '..', 'src', 'test', 'pythonFiles', 'hover');
const fileOne = path.join(autoCompPath, 'one.py');
const fileThree = path.join(autoCompPath, 'three.py');
const fileEncoding = path.join(autoCompPath, 'four.py');
const fileEncodingUsed = path.join(autoCompPath, 'five.py');
const fileHover = path.join(autoCompPath, 'hoverTest.py');
const fileStringFormat = path.join(hoverPath, 'stringFormat.py');

let textDocument: vscode.TextDocument;

// tslint:disable-next-line:max-func-body-length
suite('Hover Definition (Analysis Engine)', () => {
    suiteSetup(async function () {
        if (!IS_ANALYSIS_ENGINE_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(closeActiveWindows);
    teardown(closeActiveWindows);

    async function openAndHover(file: string, line: number, character: number): Promise<vscode.Hover[]> {
        textDocument = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(textDocument);
        const position = new vscode.Position(line, character);
        const result = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', textDocument.uri, position);
        return result ? result : [];
    }

    test('Method', async () => {
        const def = await openAndHover(fileOne, 30, 5);
        assert.equal(def.length, 1, 'Definition length is incorrect');

        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '30,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '30,11', 'End position is incorrect');
        assert.equal(def[0].contents.length, 1, 'Invalid content items');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            'obj.method1:',
            '```python',
            'method method1 of one.Class1 objects',
            '```',
            'This is method1'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Across files', async () => {
        const def = await openAndHover(fileThree, 1, 12);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,12', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            'two.ct().fun:',
            '```python',
            'method fun of two.ct objects',
            '```',
            'This is fun'
        ];
        verifySignatureLines(actual, expected);
    });

    test('With Unicode Characters', async () => {
        const def = await openAndHover(fileEncoding, 25, 6);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '25,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '25,7', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            '```python',
            'four.Foo.bar() -> bool',
            'declared in Foo',
            '```',
            '说明 - keep this line, it works',
            'delete following line, it works',
            '如果存在需要等待审批或正在执行的任务，将不刷新页面'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Across files with Unicode Characters', async () => {
        const def = await openAndHover(fileEncodingUsed, 1, 11);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '1,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '1,16', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            '```python',
            'four.showMessage()',
            '```',
            'Кюм ут жэмпэр пошжим льаборэж, коммюны янтэрэсщэт нам ед, декта игнота ныморэ жят эи.',
            'Шэа декам экшырки эи, эи зыд эррэм докэндё, векж факэтэ пэрчыквюэрёж ку.'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Nothing for keywords (class)', async () => {
        const def = await openAndHover(fileOne, 5, 1);
        if (def.length > 0) {
            const actual = normalizeMarkedString(def[0].contents[0]);
            assert.equal(actual, '', 'Definition length is incorrect');
        }
    });

    test('Nothing for keywords (for)', async () => {
        const def = await openAndHover(fileHover, 3, 1);
        if (def.length > 0) {
            const actual = normalizeMarkedString(def[0].contents[0]);
            assert.equal(actual, '', 'Definition length is incorrect');
        }
    });

    test('Highlighting Class', async () => {
        const def = await openAndHover(fileHover, 11, 15);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '11,7', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '11,18', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            '```python',
            'class misc.Random(_random.Random)',
            '```',
            'Random number generator base class used by bound module functions.',
            'Used to instantiate instances of Random to get generators that don\'t',
            'share state.',
            'Class Random can also be subclassed if you want to use a different basic',
            'generator of your own devising: in that case, override the following',
            'methods: random(), seed(), getstate(), and setstate().',
            'Optionally, implement a getrandbits() method so that randrange()',
            'can cover arbitrarily large ranges.'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Highlight Method', async () => {
        const def = await openAndHover(fileHover, 12, 10);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '12,0', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '12,12', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            'rnd2.randint:',
            '```python',
            'method randint of misc.Random objects  -> int',
            '```',
            'Return random integer in range [a, b], including both end points.'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Highlight Function', async () => {
        const def = await openAndHover(fileHover, 8, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '8,6', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '8,15', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            '```python',
            'acos(x)',
            '```',
            'acos(x)',
            'Return the arc cosine (measured in radians) of x.'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Highlight Multiline Method Signature', async () => {
        const def = await openAndHover(fileHover, 14, 14);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(`${def[0].range!.start.line},${def[0].range!.start.character}`, '14,4', 'Start position is incorrect');
        assert.equal(`${def[0].range!.end.line},${def[0].range!.end.character}`, '14,15', 'End position is incorrect');

        const actual = normalizeMarkedString(def[0].contents[0]).splitLines();
        const expected = [
            '```python',
            'class misc.Thread(_Verbose)',
            '```',
            'A class that represents a thread of control.',
            'This class can be safely subclassed in a limited fashion.'
        ];
        verifySignatureLines(actual, expected);
    });

    test('Variable', async () => {
        const def = await openAndHover(fileHover, 6, 2);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('Random') === -1) {
            assert.fail(contents, '', 'Variable type is missing', 'compare');
        }
    });

    test('format().capitalize()', async function () {
        // https://github.com/Microsoft/PTVS/issues/3868
        // tslint:disable-next-line:no-invalid-this
        this.skip();
        const def = await openAndHover(fileStringFormat, 5, 41);
        assert.equal(def.length, 1, 'Definition length is incorrect');
        assert.equal(def[0].contents.length, 1, 'Only expected one result');
        const contents = normalizeMarkedString(def[0].contents[0]);
        if (contents.indexOf('capitalize') === -1) {
            assert.fail(contents, '', '\'capitalize\' is missing', 'compare');
        }
        if (contents.indexOf('Return a capitalized version of S') === -1 &&
            contents.indexOf('Return a copy of the string S with only its first character') === -1) {
            assert.fail(contents, '', '\'Return a capitalized version of S/Return a copy of the string S with only its first character\' message missing', 'compare');
        }
    });

    function verifySignatureLines(actual: string[], expected: string[]) {
        assert.equal(actual.length, expected.length, 'incorrect number of lines');
        for (let i = 0; i < actual.length; i += 1) {
            actual[i] = actual[i].replace(new RegExp('&nbsp;', 'g'), ' ');
            assert.equal(actual[i].trim(), expected[i], `signature line ${i + 1} is incorrect`);
        }
    }
});
