// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-invalid-template-strings no-any no-object-literal-type-assertion

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { DebugConfiguration, DebugConfigurationProvider, TextDocument, TextEditor, Uri, WorkspaceFolder } from 'vscode';
import { IDocumentManager, IWorkspaceService } from '../../../client/common/application/types';
import { PythonLanguage } from '../../../client/common/constants';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { PythonDebugConfigurationProvider, PythonV2DebugConfigurationProvider } from '../../../client/debugger';
import { DebugOptions } from '../../../client/debugger/Common/Contracts';
import { IServiceContainer } from '../../../client/ioc/types';

[
    { debugType: 'pythonExperimental', class: PythonV2DebugConfigurationProvider },
    { debugType: 'python', class: PythonDebugConfigurationProvider }
].forEach(provider => {
    suite(`Debugging - Config Provider ${provider.debugType}`, () => {
        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
        let debugProvider: DebugConfigurationProvider;
        let platformService: TypeMoq.IMock<IPlatformService>;
        let fileSystem: TypeMoq.IMock<IFileSystem>;
        setup(() => {
            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
            debugProvider = new provider.class(serviceContainer.object);
        });
        function createMoqWorkspaceFolder(folderPath: string) {
            const folder = TypeMoq.Mock.ofType<WorkspaceFolder>();
            folder.setup(f => f.uri).returns(() => Uri.file(folderPath));
            return folder.object;
        }
        function setupIoc(pythonPath: string, isWindows: boolean = false, isMac: boolean = false, isLinux: boolean = false) {
            const confgService = TypeMoq.Mock.ofType<IConfigurationService>();
            platformService = TypeMoq.Mock.ofType<IPlatformService>();
            fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => confgService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
            const settings = TypeMoq.Mock.ofType<IPythonSettings>();
            settings.setup(s => s.pythonPath).returns(() => pythonPath);
            confgService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
            setupOs(isWindows, isMac, isLinux);
        }
        function setupActiveEditor(fileName: string | undefined, languageId: string) {
            const documentManager = TypeMoq.Mock.ofType<IDocumentManager>();
            if (fileName) {
                const textEditor = TypeMoq.Mock.ofType<TextEditor>();
                const document = TypeMoq.Mock.ofType<TextDocument>();
                document.setup(d => d.languageId).returns(() => languageId);
                document.setup(d => d.fileName).returns(() => fileName);
                textEditor.setup(t => t.document).returns(() => document.object);
                documentManager.setup(d => d.activeTextEditor).returns(() => textEditor.object);
            } else {
                documentManager.setup(d => d.activeTextEditor).returns(() => undefined);
            }
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDocumentManager))).returns(() => documentManager.object);
        }
        function setupWorkspaces(folders: string[]) {
            const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            const workspaceFolders = folders.map(createMoqWorkspaceFolder);
            workspaceService.setup(w => w.workspaceFolders).returns(() => workspaceFolders);
            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
        }
        function setupOs(isWindows: boolean, isMac: boolean, isLinux: boolean) {
            platformService.setup(p => p.isWindows).returns(() => isWindows);
            platformService.setup(p => p.isMac).returns(() => isMac);
            platformService.setup(p => p.isLinux).returns(() => isLinux);
        }
        test('Defaults should be returned when an empty object is passed with a Workspace Folder and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);

            setupActiveEditor(pythonFile, PythonLanguage.language);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an object with \'noDebug\' property is passed with a Workspace Folder and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PythonLanguage.language);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { noDebug: true } as any as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(__dirname.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(__dirname, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PythonLanguage.language);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(path.dirname('')).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', pythonFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and no active file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            setupIoc(pythonPath);
            setupActiveEditor(undefined, PythonLanguage.language);
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', '');
            expect(debugConfig).not.to.have.property('cwd');
            expect(debugConfig).not.to.have.property('envFile');
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, no workspaces and non python file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.js';
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, 'javascript');
            setupWorkspaces([]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', '');
            expect(debugConfig).not.to.have.property('cwd');
            expect(debugConfig).not.to.have.property('envFile');
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Defaults should be returned when an empty object is passed without Workspace Folder, with a workspace and an active python file', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PythonLanguage.language);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(undefined, {} as DebugConfiguration);
            const filePath = Uri.file(defaultWorkspace).fsPath;

            expect(Object.keys(debugConfig!)).to.have.lengthOf.above(3);
            expect(debugConfig).to.have.property('pythonPath', pythonPath);
            expect(debugConfig).to.have.property('type', provider.debugType);
            expect(debugConfig).to.have.property('request', 'launch');
            expect(debugConfig).to.have.property('program', activeFile);
            expect(debugConfig).to.have.property('cwd');
            expect(debugConfig!.cwd!.toLowerCase()).to.be.equal(filePath.toLowerCase());
            expect(debugConfig).to.have.property('envFile');
            expect(debugConfig!.envFile!.toLowerCase()).to.be.equal(path.join(filePath, '.env').toLowerCase());
            expect(debugConfig).to.have.property('env');
            // tslint:disable-next-line:no-any
            expect(Object.keys((debugConfig as any).env)).to.have.lengthOf(0);
        });
        test('Ensure `${config:python.pythonPath}` is replaced with actual pythonPath', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PythonLanguage.language);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { pythonPath: '${config:python.pythonPath}' } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('pythonPath', pythonPath);
        });
        test('Ensure hardcoded pythonPath is left unaltered', async () => {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const activeFile = 'xyz.py';
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            setupIoc(pythonPath);
            setupActiveEditor(activeFile, PythonLanguage.language);
            const defaultWorkspace = path.join('usr', 'desktop');
            setupWorkspaces([defaultWorkspace]);

            const debugPythonPath = `Debug_PythonPath_${new Date().toString()}`;
            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, { pythonPath: debugPythonPath } as any as DebugConfiguration);

            expect(debugConfig).to.have.property('pythonPath', debugPythonPath);
        });
        test('Test defaults of experimental debugger', async () => {
            if (provider.debugType !== 'pythonExperimental') {
                return;
            }
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PythonLanguage.language);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(debugConfig).to.have.property('console', 'integratedTerminal');
            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal(['RedirectOutput']);
        });
        test('Test defaults of python debugger', async () => {
            if (provider.debugType !== 'python') {
                return;
            }
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath);
            setupActiveEditor(pythonFile, PythonLanguage.language);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);

            expect(debugConfig).to.have.property('stopOnEntry', false);
            expect(debugConfig).to.have.property('debugOptions');
            expect((debugConfig as any).debugOptions).to.be.deep.equal([DebugOptions.RedirectOutput]);
        });
        async function testFixFilePathCase(isWindows: boolean, isMac: boolean, isLinux: boolean) {
            const pythonPath = `PythonPath_${new Date().toString()}`;
            const workspaceFolder = createMoqWorkspaceFolder(__dirname);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, PythonLanguage.language);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, {} as DebugConfiguration);
            if (isWindows) {
                expect(debugConfig).to.have.property('debugOptions').contains(DebugOptions.FixFilePathCase);
            } else {
                expect(debugConfig).to.have.property('debugOptions').not.contains(DebugOptions.FixFilePathCase);
            }
        }
        test('Test fixFilePathCase for Windows', async () => {
            if (provider.debugType === 'python') {
                return;
            }
            await testFixFilePathCase(true, false, false);
        });
        test('Test fixFilePathCase for Linux', async () => {
            if (provider.debugType === 'python') {
                return;
            }
            await testFixFilePathCase(false, false, true);
        });
        test('Test fixFilePathCase for Mac', async () => {
            if (provider.debugType === 'python') {
                return;
            }
            await testFixFilePathCase(false, true, false);
        });
        async function testPyramidConfiguration(isWindows: boolean, isLinux: boolean, isMac: boolean, addPyramidDebugOption: boolean = true, pythonPathExists = true, shouldWork = true) {
            const workspacePath = path.join('usr', 'development', 'wksp1');
            const pythonPath = path.join(workspacePath, 'env', 'bin', 'python');
            const pserveExecutableName = isWindows ? 'pserve.exe' : 'pserve';
            const pservePath = pythonPathExists ? path.join(path.dirname(pythonPath), pserveExecutableName) : pserveExecutableName;
            const workspaceFolder = createMoqWorkspaceFolder(workspacePath);
            const pythonFile = 'xyz.py';
            setupIoc(pythonPath, isWindows, isMac, isLinux);
            setupActiveEditor(pythonFile, PythonLanguage.language);

            const options = addPyramidDebugOption ? { debugOptions: [DebugOptions.Pyramid] } : {};
            fileSystem.setup(fs => fs.fileExistsSync(TypeMoq.It.isValue(pythonPath))).returns(() => pythonPathExists);

            const debugConfig = await debugProvider.resolveDebugConfiguration!(workspaceFolder, options as any as DebugConfiguration);
            if (shouldWork) {
                expect(debugConfig).to.have.property('program', pservePath);
            } else {
                expect(debugConfig!.program).to.be.not.equal(pservePath);
            }
        }
        test('Program is set for Pyramid (windows)', async () => {
            await testPyramidConfiguration(true, false, false);
        });
        test('Program is set for Pyramid (Linux)', async () => {
            await testPyramidConfiguration(false, true, false);
        });
        test('Program is set for Pyramid (Mac)', async () => {
            await testPyramidConfiguration(false, false, true);
        });
        test('Program is not set for Pyramid when DebugOption is not set (windows)', async () => {
            await testPyramidConfiguration(true, false, false, false, false, false);
        });
        test('Program is not set for Pyramid when DebugOption is not set (Linux)', async () => {
            await testPyramidConfiguration(false, true, false, false, false, false);
        });
        test('Program is not set for Pyramid when DebugOption is not set (Mac)', async () => {
            await testPyramidConfiguration(false, false, true, false, false, false);
        });
        test('Program is set to executable name for Pyramid when python exec does not exist (windows)', async () => {
            await testPyramidConfiguration(true, false, false, true, false, true);
        });
        test('Program is set to executable name for Pyramid when python exec does not exist (Linux)', async () => {
            await testPyramidConfiguration(false, true, false, true, false, true);
        });
        test('Program is set to executable name for Pyramid when python exec does not exist (Mac)', async () => {
            await testPyramidConfiguration(false, false, true, true, false, true);
        });
    });
});
