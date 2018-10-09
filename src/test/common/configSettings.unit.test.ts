// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
// tslint:disable-next-line:no-require-imports
import untildify = require('untildify');
import { WorkspaceConfiguration } from 'vscode';
import {
    PythonSettings
} from '../../client/common/configSettings';
import {
    IAnalysisSettings,
    IAutoCompleteSettings,
    IFormattingSettings,
    ILintingSettings,
    ISortImportSettings,
    ITerminalSettings,
    IUnitTestSettings,
    IWorkspaceSymbolSettings
} from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';

// tslint:disable-next-line:max-func-body-length
suite('Python Settings', () => {
    let config: TypeMoq.IMock<WorkspaceConfiguration>;
    let expected: PythonSettings;
    let settings: PythonSettings;
    const CustomPythonSettings = class extends PythonSettings {
        protected initialize() { noop(); }
    };

    setup(() => {
        config = TypeMoq.Mock.ofType<WorkspaceConfiguration>(undefined, TypeMoq.MockBehavior.Strict);
        expected = new CustomPythonSettings();
        settings = new CustomPythonSettings();
    });

    function initializeConfig(sourceSettings: PythonSettings) {
        // string settings
        for (const name of ['pythonPath', 'venvPath', 'condaPath', 'envFile']) {
            config.setup(c => c.get<string>(name))
                .returns(() => sourceSettings[name]);
        }
        if (sourceSettings.jediEnabled) {
            config.setup(c => c.get<string>('jediPath'))
                .returns(() => sourceSettings.jediPath);
        }
        for (const name of ['venvFolders']) {
            config.setup(c => c.get<string[]>(name))
                .returns(() => sourceSettings[name]);
        }

        // boolean settings
        for (const name of ['downloadLanguageServer', 'jediEnabled', 'autoUpdateLanguageServer']) {
            config.setup(c => c.get<boolean>(name, true))
                .returns(() => sourceSettings[name]);
        }
        for (const name of ['disableInstallationCheck', 'globalModuleInstallation']) {
            config.setup(c => c.get<boolean>(name))
                .returns(() => sourceSettings[name]);
        }

        // number settings
        if (sourceSettings.jediEnabled) {
            config.setup(c => c.get<number>('jediMemoryLimit'))
                .returns(() => sourceSettings.jediMemoryLimit);
        }

        // "any" settings
        // tslint:disable-next-line:no-any
        config.setup(c => c.get<any[]>('devOptions'))
            .returns(() => sourceSettings.devOptions);

        // complex settings
        config.setup(c => c.get<ILintingSettings>('linting'))
            .returns(() => sourceSettings.linting);
        config.setup(c => c.get<IAnalysisSettings>('analysis'))
            .returns(() => sourceSettings.analysis);
        config.setup(c => c.get<ISortImportSettings>('sortImports'))
            .returns(() => sourceSettings.sortImports);
        config.setup(c => c.get<IFormattingSettings>('formatting'))
            .returns(() => sourceSettings.formatting);
        config.setup(c => c.get<IAutoCompleteSettings>('autoComplete'))
            .returns(() => sourceSettings.autoComplete);
        config.setup(c => c.get<IWorkspaceSymbolSettings>('workspaceSymbols'))
            .returns(() => sourceSettings.workspaceSymbols);
        config.setup(c => c.get<IUnitTestSettings>('unitTest'))
            .returns(() => sourceSettings.unitTest);
        config.setup(c => c.get<ITerminalSettings>('terminal'))
            .returns(() => sourceSettings.terminal);
    }

    test('condaPath updated', () => {
        expected.pythonPath = 'python3';
        expected.condaPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get<string>('condaPath'))
            .returns(() => expected.condaPath)
            .verifiable(TypeMoq.Times.once());

        settings.update(config.object);

        expect(settings.condaPath).to.be.equal(expected.condaPath);
        config.verifyAll();
    });

    test('condaPath (relative to home) updated', () => {
        expected.pythonPath = 'python3';
        expected.condaPath = path.join('~', 'anaconda3', 'bin', 'conda');
        initializeConfig(expected);
        config.setup(c => c.get<string>('condaPath'))
            .returns(() => expected.condaPath)
            .verifiable(TypeMoq.Times.once());

        settings.update(config.object);

        expect(settings.condaPath).to.be.equal(untildify(expected.condaPath));
        config.verifyAll();
    });

    test('Formatter Paths and args', () => {
        expected.pythonPath = 'python3';
        // tslint:disable-next-line:no-any
        expected.formatting = {
            autopep8Args: ['1', '2'], autopep8Path: 'one',
            blackArgs: ['3', '4'], blackPath: 'two',
            yapfArgs: ['5', '6'], yapfPath: 'three',
            provider: ''
        };
        expected.formatting.blackPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get<IFormattingSettings>('formatting'))
            .returns(() => expected.formatting)
            .verifiable(TypeMoq.Times.once());

        settings.update(config.object);

        for (const key of Object.keys(expected.formatting)) {
            expect(settings.formatting[key]).to.be.deep.equal(expected.formatting[key]);
        }
        config.verifyAll();
    });
    test('Formatter Paths (paths relative to home)', () => {
        expected.pythonPath = 'python3';
        // tslint:disable-next-line:no-any
        expected.formatting = {
            autopep8Args: [], autopep8Path: path.join('~', 'one'),
            blackArgs: [], blackPath: path.join('~', 'two'),
            yapfArgs: [], yapfPath: path.join('~', 'three'),
            provider: ''
        };
        expected.formatting.blackPath = 'spam';
        initializeConfig(expected);
        config.setup(c => c.get<IFormattingSettings>('formatting'))
            .returns(() => expected.formatting)
            .verifiable(TypeMoq.Times.once());

        settings.update(config.object);

        for (const key of Object.keys(expected.formatting)) {
            if (!key.endsWith('path')) {
                continue;
            }
            const expectedPath = untildify(expected.formatting[key]);
            expect(settings.formatting[key]).to.be.equal(expectedPath);
        }
        config.verifyAll();
    });
});
