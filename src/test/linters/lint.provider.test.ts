// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Container } from 'inversify';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import { IDocumentManager } from '../../client/common/application/types';
import { createDeferred } from '../../client/common/helpers';
import { IFileSystem } from '../../client/common/platform/types';
import { IConfigurationService, ILintingSettings, IPythonSettings, Product } from '../../client/common/types';
import { IInterpreterService } from '../../client/interpreter/contracts';
import { ServiceContainer } from '../../client/ioc/container';
import { ServiceManager } from '../../client/ioc/serviceManager';
import { LinterManager } from '../../client/linters/linterManager';
import { ILinterManager, ILintingEngine } from '../../client/linters/types';
import { LinterProvider } from '../../client/providers/linterProvider';
import { initialize } from '../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Linting - Provider', () => {
    let context: TypeMoq.IMock<vscode.ExtensionContext>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let engine: TypeMoq.IMock<ILintingEngine>;
    let configService: TypeMoq.IMock<IConfigurationService>;
    let docManager: TypeMoq.IMock<IDocumentManager>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let lm: ILinterManager;
    let serviceContainer: ServiceContainer;
    let emitter: vscode.EventEmitter<vscode.TextDocument>;
    let document: TypeMoq.IMock<vscode.TextDocument>;
    let fs: TypeMoq.IMock<IFileSystem>;

    suiteSetup(initialize);
    setup(async () => {
        const cont = new Container();
        const serviceManager = new ServiceManager(cont);

        serviceContainer = new ServiceContainer(cont);
        context = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

        fs = TypeMoq.Mock.ofType<IFileSystem>();
        fs.setup(x => x.fileExists(TypeMoq.It.isAny())).returns(() => new Promise<boolean>((resolve, reject) => resolve(true)));
        fs.setup(x => x.arePathsSame(TypeMoq.It.isAnyString(), TypeMoq.It.isAnyString())).returns(() => true);
        serviceManager.addSingletonInstance<IFileSystem>(IFileSystem, fs.object);

        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);

        engine = TypeMoq.Mock.ofType<ILintingEngine>();
        serviceManager.addSingletonInstance<ILintingEngine>(ILintingEngine, engine.object);

        docManager = TypeMoq.Mock.ofType<IDocumentManager>();
        serviceManager.addSingletonInstance<IDocumentManager>(IDocumentManager, docManager.object);

        const lintSettings = TypeMoq.Mock.ofType<ILintingSettings>();
        lintSettings.setup(x => x.enabled).returns(() => true);
        lintSettings.setup(x => x.lintOnSave).returns(() => true);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(x => x.linting).returns(() => lintSettings.object);

        configService = TypeMoq.Mock.ofType<IConfigurationService>();
        configService.setup(x => x.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
        serviceManager.addSingletonInstance<IConfigurationService>(IConfigurationService, configService.object);

        lm = new LinterManager(serviceContainer);
        serviceManager.addSingletonInstance<ILinterManager>(ILinterManager, lm);
        emitter = new vscode.EventEmitter<vscode.TextDocument>();
        document = TypeMoq.Mock.ofType<vscode.TextDocument>();
    });

    test('Lint on open file', () => {
        docManager.setup(x => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup(x => x.languageId).returns(() => 'python');

        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'auto'), TypeMoq.Times.once());
    });

    test('Lint on save file', () => {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.py'));
        document.setup(x => x.languageId).returns(() => 'python');

        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.once());
    });

    test('No lint on open other files', () => {
        docManager.setup(x => x.onDidOpenTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup(x => x.languageId).returns(() => 'csharp');

        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });

    test('No lint on save other files', () => {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('test.cs'));
        document.setup(x => x.languageId).returns(() => 'csharp');

        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);
        engine.verify(x => x.lintDocument(document.object, 'save'), TypeMoq.Times.never());
    });

    test('Lint on change interpreters', () => {
        const e = new vscode.EventEmitter<void>();
        interpreterService.setup(x => x.onDidChangeInterpreter).returns(() => e.event);

        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        e.fire();
        engine.verify(x => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    });

    test('Lint on save pylintrc', async () => {
        docManager.setup(x => x.onDidSaveTextDocument).returns(() => emitter.event);
        document.setup(x => x.uri).returns(() => vscode.Uri.file('.pylintrc'));

        await lm.setActiveLintersAsync([Product.pylint]);
        // tslint:disable-next-line:no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);
        emitter.fire(document.object);

        const deferred = createDeferred<void>();
        setTimeout(() => deferred.resolve(), 2000);
        await deferred.promise;
        engine.verify(x => x.lintOpenPythonFiles(), TypeMoq.Times.once());
    });

    test('Diagnostic cleared on file close', () => testClearDiagnosticsOnClose(true));
    test('Diagnostic not cleared on file opened in another tab', () => testClearDiagnosticsOnClose(false));

    function testClearDiagnosticsOnClose(closed: boolean) {
        docManager.setup(x => x.onDidCloseTextDocument).returns(() => emitter.event);

        const uri = vscode.Uri.file('test.py');
        document.setup(x => x.uri).returns(() => uri);
        document.setup(x => x.isClosed).returns(() => closed);

        docManager.setup(x => x.textDocuments).returns(() => closed ? [] : [document.object]);
        // tslint:disable-next-line:prefer-const no-unused-variable
        const provider = new LinterProvider(context.object, serviceContainer);

        emitter.fire(document.object);
        const timesExpected = closed ? TypeMoq.Times.once() : TypeMoq.Times.never();
        engine.verify(x => x.clearDiagnostics(TypeMoq.It.isAny()), timesExpected);
    }
});
