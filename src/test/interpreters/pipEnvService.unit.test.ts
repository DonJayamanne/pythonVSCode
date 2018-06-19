// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceFolder } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { EnumEx } from '../../client/common/enumUtils';
import { IFileSystem, IPlatformService } from '../../client/common/platform/types';
import { IProcessService, IProcessServiceFactory } from '../../client/common/process/types';
import { ICurrentProcess, ILogger, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../client/common/variables/types';
import { IInterpreterHelper, IInterpreterLocatorService } from '../../client/interpreter/contracts';
import { PipEnvService } from '../../client/interpreter/locators/services/pipEnvService';
import { IServiceContainer } from '../../client/ioc/types';

enum OS {
    Mac, Windows, Linux
}

suite('Interpreters - PipEnv', () => {
    const rootWorkspace = Uri.file(path.join('usr', 'desktop', 'wkspc1')).fsPath;
    EnumEx.getNamesAndValues(OS).forEach(os => {
        [undefined, Uri.file(path.join(rootWorkspace, 'one.py'))].forEach(resource => {
            const testSuffix = ` (${os.name}, ${resource ? 'with' : 'without'} a workspace)`;

            let pipEnvService: IInterpreterLocatorService;
            let serviceContainer: TypeMoq.IMock<IServiceContainer>;
            let interpreterHelper: TypeMoq.IMock<IInterpreterHelper>;
            let processService: TypeMoq.IMock<IProcessService>;
            let currentProcess: TypeMoq.IMock<ICurrentProcess>;
            let fileSystem: TypeMoq.IMock<IFileSystem>;
            let appShell: TypeMoq.IMock<IApplicationShell>;
            let persistentStateFactory: TypeMoq.IMock<IPersistentStateFactory>;
            let envVarsProvider: TypeMoq.IMock<IEnvironmentVariablesProvider>;
            let procServiceFactory: TypeMoq.IMock<IProcessServiceFactory>;
            let logger: TypeMoq.IMock<ILogger>;
            let platformService: TypeMoq.IMock<IPlatformService>;
            setup(() => {
                serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
                interpreterHelper = TypeMoq.Mock.ofType<IInterpreterHelper>();
                fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                processService = TypeMoq.Mock.ofType<IProcessService>();
                appShell = TypeMoq.Mock.ofType<IApplicationShell>();
                currentProcess = TypeMoq.Mock.ofType<ICurrentProcess>();
                persistentStateFactory = TypeMoq.Mock.ofType<IPersistentStateFactory>();
                envVarsProvider = TypeMoq.Mock.ofType<IEnvironmentVariablesProvider>();
                procServiceFactory = TypeMoq.Mock.ofType<IProcessServiceFactory>();
                logger = TypeMoq.Mock.ofType<ILogger>();
                platformService = TypeMoq.Mock.ofType<IPlatformService>();
                processService.setup((x: any) => x.then).returns(() => undefined);
                procServiceFactory.setup(p => p.create(TypeMoq.It.isAny())).returns(() => Promise.resolve(processService.object));

                // tslint:disable-next-line:no-any
                const persistentState = TypeMoq.Mock.ofType<IPersistentState<any>>();
                persistentStateFactory.setup(p => p.createGlobalPersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentStateFactory.setup(p => p.createWorkspacePersistentState(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => persistentState.object);
                persistentState.setup(p => p.value).returns(() => undefined);
                persistentState.setup(p => p.updateValue(TypeMoq.It.isAny())).returns(() => Promise.resolve());

                const workspaceFolder = TypeMoq.Mock.ofType<WorkspaceFolder>();
                workspaceFolder.setup(w => w.uri).returns(() => Uri.file(rootWorkspace));
                workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => workspaceFolder.object);
                workspaceService.setup(w => w.rootPath).returns(() => rootWorkspace);

                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IProcessServiceFactory), TypeMoq.It.isAny())).returns(() => procServiceFactory.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IWorkspaceService))).returns(() => workspaceService.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterHelper))).returns(() => interpreterHelper.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ICurrentProcess))).returns(() => currentProcess.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IFileSystem))).returns(() => fileSystem.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IApplicationShell))).returns(() => appShell.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPersistentStateFactory))).returns(() => persistentStateFactory.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IEnvironmentVariablesProvider))).returns(() => envVarsProvider.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ILogger))).returns(() => logger.object);
                serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IPlatformService))).returns(() => platformService.object);

                pipEnvService = new PipEnvService(serviceContainer.object);
            });

            test(`Should return an empty list'${testSuffix}`, () => {
                const environments = pipEnvService.getInterpreters(resource);
                expect(environments).to.be.eventually.deep.equal([]);
            });
            test(`Should return an empty list if there is no \'PipFile\'${testSuffix}`, async () => {
                const env = {};
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.once());
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                fileSystem.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes ${testSuffix}`, async () => {
                const env = {};
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.reject(''));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                logger.setup(l => l.logWarning(TypeMoq.It.isAny(), TypeMoq.It.isAny())).verifiable(TypeMoq.Times.exactly(2));
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
                logger.verifyAll();
            });
            test(`Should display warning message if there is a \'PipFile\' but \'pipenv --venv\' failes with stderr ${testSuffix}`, async () => {
                const env = {};
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stderr: 'PipEnv Failed', stdout: '' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true));
                appShell.setup(a => a.showWarningMessage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve('')).verifiable(TypeMoq.Times.once());
                logger.setup(l => l.logWarning(TypeMoq.It.isAny(), TypeMoq.It.isAny())).verifiable(TypeMoq.Times.exactly(2));
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.deep.equal([]);
                appShell.verifyAll();
                logger.verifyAll();
            });
            test(`Should return interpreter information${testSuffix}`, async () => {
                const env = {};
                const pythonPath = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'xyz' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(true)).verifiable();
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true)).verifiable();
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            });
            test(`Should return interpreter information using PipFile defined in Env variable${testSuffix}`, async () => {
                const envPipFile = 'XYZ';
                const env = {
                    PIPENV_PIPFILE: envPipFile
                };
                const pythonPath = 'one';
                envVarsProvider.setup(e => e.getEnvironmentVariables(TypeMoq.It.isAny())).returns(() => Promise.resolve({})).verifiable(TypeMoq.Times.once());
                currentProcess.setup(c => c.env).returns(() => env);
                processService.setup(p => p.exec(TypeMoq.It.isValue('pipenv'), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve({ stdout: pythonPath }));
                interpreterHelper.setup(v => v.getInterpreterInformation(TypeMoq.It.isAny())).returns(() => Promise.resolve({ version: 'xyz' }));
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, 'Pipfile')))).returns(() => Promise.resolve(false)).verifiable(TypeMoq.Times.never());
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(path.join(rootWorkspace, envPipFile)))).returns(() => Promise.resolve(true)).verifiable(TypeMoq.Times.once());
                fileSystem.setup(fs => fs.fileExists(TypeMoq.It.isValue(pythonPath))).returns(() => Promise.resolve(true)).verifiable();
                const environments = await pipEnvService.getInterpreters(resource);

                expect(environments).to.be.lengthOf(1);
                fileSystem.verifyAll();
            });
        });
    });
});
