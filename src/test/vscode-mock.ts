// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-require-imports no-var-requires no-any

import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as vscodeMocks from './mocks/vsc';
import { vscMockTelemetryReporter } from './mocks/vsc/telemetryReporter';
const Module = require('module');

type VSCode = typeof vscode;

const mockedVSCode: Partial<VSCode> = {};
const mockedVSCodeNamespaces: { [P in keyof VSCode]?: TypeMoq.IMock<VSCode[P]> } = {};
const originalLoad = Module._load;

function generateMock<K extends keyof VSCode>(name: K): void {
    const mockedObj = TypeMoq.Mock.ofType<VSCode[K]>();
    mockedVSCode[name] = mockedObj.object;
    mockedVSCodeNamespaces[name] = mockedObj as any;
}

export function initialize() {
    generateMock('workspace');
    generateMock('window');
    generateMock('commands');
    generateMock('languages');
    generateMock('env');
    generateMock('debug');
    generateMock('scm');

    // When upgrading to npm 9-10, this might have to change, as we could have explicit imports (named imports).
    Module._load = function (request, parent) {
        if (request === 'vscode') {
            return mockedVSCode;
        }
        if (request === 'vscode-extension-telemetry') {
            return { default: vscMockTelemetryReporter };
        }
        return originalLoad.apply(this, arguments);
    };
}

mockedVSCode.Disposable = vscodeMocks.vscMock.Disposable as any;
mockedVSCode.EventEmitter = vscodeMocks.vscMock.EventEmitter;
mockedVSCode.CancellationTokenSource = vscodeMocks.vscMock.CancellationTokenSource;
mockedVSCode.CompletionItemKind = vscodeMocks.vscMock.CompletionItemKind;
mockedVSCode.SymbolKind = vscodeMocks.vscMock.SymbolKind;
mockedVSCode.Uri = vscodeMocks.vscMock.Uri as any;
mockedVSCode.Range = vscodeMocks.vscMockExtHostedTypes.Range;
mockedVSCode.Position = vscodeMocks.vscMockExtHostedTypes.Position;
mockedVSCode.Selection = vscodeMocks.vscMockExtHostedTypes.Selection;
mockedVSCode.Location = vscodeMocks.vscMockExtHostedTypes.Location;
mockedVSCode.SymbolInformation = vscodeMocks.vscMockExtHostedTypes.SymbolInformation;
mockedVSCode.CompletionItem = vscodeMocks.vscMockExtHostedTypes.CompletionItem;
mockedVSCode.CompletionItemKind = vscodeMocks.vscMockExtHostedTypes.CompletionItemKind;
mockedVSCode.CodeLens = vscodeMocks.vscMockExtHostedTypes.CodeLens;
mockedVSCode.DiagnosticSeverity = vscodeMocks.vscMockExtHostedTypes.DiagnosticSeverity;
mockedVSCode.SnippetString = vscodeMocks.vscMockExtHostedTypes.SnippetString;
mockedVSCode.EventEmitter = vscodeMocks.vscMock.EventEmitter;
mockedVSCode.ConfigurationTarget = vscodeMocks.vscMockExtHostedTypes.ConfigurationTarget;
mockedVSCode.StatusBarAlignment = vscodeMocks.vscMockExtHostedTypes.StatusBarAlignment;

// This API is used in src/client/telemetry/telemetry.ts
const extensions = TypeMoq.Mock.ofType<typeof vscode.extensions>();
extensions.setup(e => e.all).returns(() => []);
const extension = TypeMoq.Mock.ofType<vscode.Extension<any>>();
const packageJson = TypeMoq.Mock.ofType<any>();
const contributes = TypeMoq.Mock.ofType<any>();
extension.setup(e => e.packageJSON).returns(() => packageJson.object);
packageJson.setup(p => p.contributes).returns(() => contributes.object);
contributes.setup(p => p.debuggers).returns(() => [{ aiKey: '' }]);
extensions.setup(e => e.getExtension(TypeMoq.It.isAny())).returns(() => extension.object);
mockedVSCode.extensions = extensions.object;
