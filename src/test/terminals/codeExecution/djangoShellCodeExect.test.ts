// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-multiline-string no-trailing-whitespace

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Disposable, Uri, WorkspaceFolder } from 'vscode';
import { ICommandManager, IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { ITerminalService, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IConfigurationService, IPythonSettings, ITerminalSettings } from '../../../client/common/types';
import { DjangoShellCodeExecutionProvider } from '../../../client/terminals/codeExecution/djangoShellCodeExecution';
import { ICodeExecutionService } from '../../../client/terminals/types';
import { PYTHON_PATH } from '../../common';

// tslint:disable-next-line:max-func-body-length
suite('Terminal - Django Shell Code Execution', () => {
    let executor: ICodeExecutionService;
    let terminalSettings: TypeMoq.IMock<ITerminalSettings>;
    let terminalService: TypeMoq.IMock<ITerminalService>;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let platform: TypeMoq.IMock<IPlatformService>;
    let settings: TypeMoq.IMock<IPythonSettings>;
    let disposables: Disposable[] = [];
    setup(() => {
        const terminalFactory = TypeMoq.Mock.ofType<ITerminalServiceFactory>();
        terminalSettings = TypeMoq.Mock.ofType<ITerminalSettings>();
        terminalService = TypeMoq.Mock.ofType<ITerminalService>();
        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspace.setup(c => c.onDidChangeWorkspaceFolders(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
            return {
                dispose: () => void 0
            };
        });
        platform = TypeMoq.Mock.ofType<IPlatformService>();
        const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
        const commandManager = TypeMoq.Mock.ofType<ICommandManager>();
        const fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
        executor = new DjangoShellCodeExecutionProvider(terminalFactory.object, configService.object,
            workspace.object, documentManager.object, platform.object, commandManager.object, fileSystem.object, disposables);

        terminalFactory.setup(f => f.getTerminalService(TypeMoq.It.isAny())).returns(() => terminalService.object);

        settings = TypeMoq.Mock.ofType<IPythonSettings>();
        settings.setup(s => s.terminal).returns(() => terminalSettings.object);
        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });

        disposables = [];
    });

    function testReplCommandArguments(isWindows: boolean, pythonPath: string, expectedPythonPath: string,
        terminalArgs: string[], expectedTerminalArgs: string[], resource?: Uri) {
        platform.setup(p => p.isWindows).returns(() => isWindows);
        settings.setup(s => s.pythonPath).returns(() => pythonPath);
        terminalSettings.setup(t => t.launchArgs).returns(() => terminalArgs);

        const replCommandArgs = (executor as DjangoShellCodeExecutionProvider).getReplCommandArgs(resource);
        expect(replCommandArgs).not.to.be.an('undefined', 'Command args is undefined');
        expect(replCommandArgs.command).to.be.equal(expectedPythonPath, 'Incorrect python path');
        expect(replCommandArgs.args).to.be.deep.equal(expectedTerminalArgs, 'Incorrect arguments');
    }

    test('Ensure fully qualified python path is escaped when building repl args on Windows', async () => {
        const pythonPath = 'c:\\program files\\python\\python.exe';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');

        testReplCommandArguments(true, pythonPath, 'c:/program files/python/python.exe', terminalArgs, expectedTerminalArgs);
    });

    test('Ensure fully qualified python path is returned as is, when building repl args on Windows', async () => {
        const pythonPath = 'c:/program files/python/python.exe';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    });

    test('Ensure python path is returned as is, when building repl args on Windows', async () => {
        const pythonPath = PYTHON_PATH;
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    });

    test('Ensure fully qualified python path is returned as is, on non Windows', async () => {
        const pythonPath = 'usr/bin/python';
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    });

    test('Ensure python path is returned as is, on non Windows', async () => {
        const pythonPath = PYTHON_PATH;
        const terminalArgs = ['-a', 'b', 'c'];
        const expectedTerminalArgs = terminalArgs.concat('manage.py', 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs);
    });

    test('Ensure current workspace folder (containing spaces) is used to prefix manage.py', async () => {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = Uri.file(path.join('c', 'usr', 'program files'));
        const workspaceFolder: WorkspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
        const expectedTerminalArgs = terminalArgs.concat(`${path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument()}`, 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, Uri.file('x'));
    });

    test('Ensure current workspace folder (without spaces) is used to prefix manage.py', async () => {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = Uri.file(path.join('c', 'usr', 'programfiles'));
        const workspaceFolder: WorkspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder);
        const expectedTerminalArgs = terminalArgs.concat(path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument(), 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, Uri.file('x'));
    });

    test('Ensure default workspace folder (containing spaces) is used to prefix manage.py', async () => {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = Uri.file(path.join('c', 'usr', 'program files'));
        const workspaceFolder: WorkspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder]);
        const expectedTerminalArgs = terminalArgs.concat(`${path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument()}`, 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, Uri.file('x'));
    });

    test('Ensure default workspace folder (without spaces) is used to prefix manage.py', async () => {
        const pythonPath = 'python1234';
        const terminalArgs = ['-a', 'b', 'c'];
        const workspaceUri = Uri.file(path.join('c', 'usr', 'programfiles'));
        const workspaceFolder: WorkspaceFolder = { index: 0, name: 'blah', uri: workspaceUri };
        workspace.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);
        workspace.setup(w => w.workspaceFolders).returns(() => [workspaceFolder]);
        const expectedTerminalArgs = terminalArgs.concat(path.join(workspaceUri.fsPath, 'manage.py').fileToCommandArgument(), 'shell');

        testReplCommandArguments(true, pythonPath, pythonPath, terminalArgs, expectedTerminalArgs, Uri.file('x'));
    });

});
