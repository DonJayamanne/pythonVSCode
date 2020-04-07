// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Uri } from 'vscode';
import { IWorkspaceService } from '../../../common/application/types';
import { DeprecatePythonPath } from '../../../common/experimentGroups';
import { traceVerbose } from '../../../common/logger';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IExperimentsManager, IInterpreterPathService, IPersistentStateFactory, Resource } from '../../../common/types';
import { createDeferredFromPromise } from '../../../common/utils/async';
import { OSType } from '../../../common/utils/platform';
import {
    IInterpreterHelper,
    IInterpreterLocatorService,
    PIPENV_SERVICE,
    PythonInterpreter,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../../contracts';
import { AutoSelectionRule, IInterpreterAutoSelectionService } from '../types';
import { BaseRuleService, NextAction } from './baseRule';

@injectable()
export class WorkspaceVirtualEnvInterpretersAutoSelectionRule extends BaseRuleService {
    constructor(
        @inject(IFileSystem) fs: IFileSystem,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IInterpreterLocatorService)
        @named(PIPENV_SERVICE)
        private readonly pipEnvInterpreterLocator: IInterpreterLocatorService,
        @inject(IInterpreterLocatorService)
        @named(WORKSPACE_VIRTUAL_ENV_SERVICE)
        private readonly workspaceVirtualEnvInterpreterLocator: IInterpreterLocatorService,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService
    ) {
        super(AutoSelectionRule.workspaceVirtualEnvs, fs, stateFactory);
    }
    protected async onAutoSelectInterpreter(
        resource: Resource,
        manager?: IInterpreterAutoSelectionService
    ): Promise<NextAction> {
        const workspacePath = this.helper.getActiveWorkspaceUri(resource);
        if (!workspacePath) {
            return NextAction.runNextRule;
        }

        const pythonConfig = this.workspaceService.getConfiguration('python', workspacePath.folderUri)!;
        const pythonPathInConfig = this.experiments.inExperiment(DeprecatePythonPath.experiment)
            ? this.interpreterPathService.inspect(workspacePath.folderUri)
            : pythonConfig.inspect<string>('pythonPath')!;
        this.experiments.sendTelemetryIfInExperiment(DeprecatePythonPath.control);
        // If user has defined custom values in settings for this workspace folder, then use that.
        if (pythonPathInConfig.workspaceFolderValue || pythonPathInConfig.workspaceValue) {
            return NextAction.runNextRule;
        }
        const pipEnvPromise = createDeferredFromPromise(
            this.pipEnvInterpreterLocator.getInterpreters(workspacePath.folderUri, true)
        );
        const virtualEnvPromise = createDeferredFromPromise(
            this.getWorkspaceVirtualEnvInterpreters(workspacePath.folderUri)
        );

        // Use only one, we currently do not have support for both pipenv and virtual env in same workspace.
        // If users have this, then theu can specify which one is to be used.
        const interpreters = await Promise.race([pipEnvPromise.promise, virtualEnvPromise.promise]);
        let bestInterpreter: PythonInterpreter | undefined;
        if (Array.isArray(interpreters) && interpreters.length > 0) {
            bestInterpreter = this.helper.getBestInterpreter(interpreters);
        } else {
            const [pipEnv, virtualEnv] = await Promise.all([pipEnvPromise.promise, virtualEnvPromise.promise]);
            const pipEnvList = Array.isArray(pipEnv) ? pipEnv : [];
            const virtualEnvList = Array.isArray(virtualEnv) ? virtualEnv : [];
            bestInterpreter = this.helper.getBestInterpreter(pipEnvList.concat(virtualEnvList));
        }
        if (bestInterpreter && manager) {
            await super.cacheSelectedInterpreter(workspacePath.folderUri, bestInterpreter);
            await manager.setWorkspaceInterpreter(workspacePath.folderUri!, bestInterpreter);
        }

        traceVerbose(
            `Selected Interpreter from ${this.ruleName}, ${
                bestInterpreter ? JSON.stringify(bestInterpreter) : 'Nothing Selected'
            }`
        );
        return NextAction.runNextRule;
    }
    protected async getWorkspaceVirtualEnvInterpreters(resource: Resource): Promise<PythonInterpreter[] | undefined> {
        if (!resource) {
            return;
        }
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
            return;
        }
        // Now check virtual environments under the workspace root
        const interpreters = await this.workspaceVirtualEnvInterpreterLocator.getInterpreters(resource, true);
        const workspacePath =
            this.platform.osType === OSType.Windows
                ? workspaceFolder.uri.fsPath.toUpperCase()
                : workspaceFolder.uri.fsPath;

        return interpreters.filter(interpreter => {
            const fsPath = Uri.file(interpreter.path).fsPath;
            const fsPathToCompare = this.platform.osType === OSType.Windows ? fsPath.toUpperCase() : fsPath;
            return fsPathToCompare.startsWith(workspacePath);
        });
    }
}
