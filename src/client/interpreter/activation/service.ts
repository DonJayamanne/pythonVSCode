// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IWorkspaceService } from '../../common/application/types';
import { PYTHON_WARNINGS } from '../../common/constants';
import { IPlatformService } from '../../common/platform/types';
import * as internalScripts from '../../common/process/internal/scripts';
import { ExecutionResult, IProcessServiceFactory } from '../../common/process/types';
import { ITerminalHelper, TerminalShellType } from '../../common/terminal/types';
import { ICurrentProcess, IDisposable, Resource } from '../../common/types';
import { sleep } from '../../common/utils/async';
import { InMemoryCache } from '../../common/utils/cacheUtils';
import { OSType } from '../../common/utils/platform';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { EnvironmentType, PythonEnvironment } from '../../pythonEnvironments/info';
import { captureTelemetry, sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IInterpreterService } from '../contracts';
import { IEnvironmentActivationService } from './types';
import { TraceOptions } from '../../logging/types';
import {
    traceDecoratorError,
    traceDecoratorVerbose,
    traceError,
    traceInfo,
    traceVerbose,
    traceWarn,
} from '../../logging';
import { Conda } from '../../pythonEnvironments/common/environmentManagers/conda';

const ENVIRONMENT_PREFIX = 'e8b39361-0157-4923-80e1-22d70d46dee6';
const CACHE_DURATION = 10 * 60 * 1000;
const ENVIRONMENT_TIMEOUT = 30000;
const CONDA_ENVIRONMENT_TIMEOUT = 60_000;

// The shell under which we'll execute activation scripts.
export const defaultShells = {
    [OSType.Windows]: { shell: 'cmd', shellType: TerminalShellType.commandPrompt },
    [OSType.OSX]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Linux]: { shell: 'bash', shellType: TerminalShellType.bash },
    [OSType.Unknown]: undefined,
};

const condaRetryMessages = [
    'The process cannot access the file because it is being used by another process',
    'The directory is not empty',
];

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private readonly activatedEnvVariablesCache = new Map<string, InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>>();
    constructor(
        @inject(ITerminalHelper) private readonly helper: ITerminalHelper,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory,
        @inject(ICurrentProcess) private currentProcess: ICurrentProcess,
        @inject(IWorkspaceService) private workspace: IWorkspaceService,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IEnvironmentVariablesProvider) private readonly envVarsService: IEnvironmentVariablesProvider,
    ) {
        this.envVarsService.onDidEnvironmentVariablesChange(
            () => this.activatedEnvVariablesCache.clear(),
            this,
            this.disposables,
        );

        this.interpreterService.onDidChangeInterpreter(
            () => this.activatedEnvVariablesCache.clear(),
            this,
            this.disposables,
        );
    }

    public dispose(): void {
        this.disposables.forEach((d) => d.dispose());
    }
    @traceDecoratorVerbose('getActivatedEnvironmentVariables', TraceOptions.Arguments)
    @captureTelemetry(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, { failed: false }, true)
    public async getActivatedEnvironmentVariables(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined> {
        // Cache key = resource + interpreter.
        const workspaceKey = this.workspace.getWorkspaceFolderIdentifier(resource);
        const interpreterPath = this.platform.isWindows ? interpreter?.path.toLowerCase() : interpreter?.path;
        const cacheKey = `${workspaceKey}_${interpreterPath}`;

        if (this.activatedEnvVariablesCache.get(cacheKey)?.hasData) {
            return this.activatedEnvVariablesCache.get(cacheKey)!.data;
        }

        // Cache only if successful, else keep trying & failing if necessary.
        const cache = new InMemoryCache<Promise<NodeJS.ProcessEnv | undefined>>(CACHE_DURATION);
        this.activatedEnvVariablesCache.set(cacheKey, cache);
        cache.data = this.getActivatedEnvironmentVariablesImpl(resource, interpreter, allowExceptions);
        return cache.data;
    }
    public async getEnvironmentActivationShellCommands(
        resource: Resource,
        interpreter?: PythonEnvironment,
    ): Promise<string[] | undefined> {
        const shellInfo = defaultShells[this.platform.osType];
        if (!shellInfo) {
            return [];
        }
        return this.helper.getEnvironmentActivationShellCommands(resource, shellInfo.shellType, interpreter);
    }
    public async getActivatedEnvironmentVariablesImpl(
        resource: Resource,
        interpreter?: PythonEnvironment,
        allowExceptions?: boolean,
    ): Promise<NodeJS.ProcessEnv | undefined> {
        const shellInfo = defaultShells[this.platform.osType];
        if (!shellInfo) {
            return;
        }
        try {
            let command: string | undefined;
            let [args, parse] = internalScripts.printEnvVariables();
            args.forEach((arg, i) => {
                args[i] = arg.toCommandArgumentForPythonExt();
            });
            interpreter = interpreter ?? (await this.interpreterService.getActiveInterpreter(resource));
            if (interpreter?.envType === EnvironmentType.Conda) {
                const conda = await Conda.getConda();
                const pythonArgv = await conda?.getRunPythonArgs({
                    name: interpreter.envName,
                    prefix: interpreter.envPath ?? '',
                });
                if (pythonArgv) {
                    // Using environment prefix isn't needed as the marker script already takes care of it.
                    command = [...pythonArgv, ...args].map((arg) => arg.toCommandArgumentForPythonExt()).join(' ');
                }
            }
            if (!command) {
                const activationCommands = await this.helper.getEnvironmentActivationShellCommands(
                    resource,
                    shellInfo.shellType,
                    interpreter,
                );
                traceVerbose(`Activation Commands received ${activationCommands} for shell ${shellInfo.shell}`);
                if (!activationCommands || !Array.isArray(activationCommands) || activationCommands.length === 0) {
                    return;
                }
                // Run the activate command collect the environment from it.
                const activationCommand = this.fixActivationCommands(activationCommands).join(' && ');
                // In order to make sure we know where the environment output is,
                // put in a dummy echo we can look for
                command = `${activationCommand} && echo '${ENVIRONMENT_PREFIX}' && python ${args.join(' ')}`;
            }

            const processService = await this.processServiceFactory.create(resource);
            const customEnvVars = await this.envVarsService.getEnvironmentVariables(resource);
            const hasCustomEnvVars = Object.keys(customEnvVars).length;
            const env = hasCustomEnvVars ? customEnvVars : { ...this.currentProcess.env };

            // Make sure python warnings don't interfere with getting the environment. However
            // respect the warning in the returned values
            const oldWarnings = env[PYTHON_WARNINGS];
            env[PYTHON_WARNINGS] = 'ignore';

            traceVerbose(`${hasCustomEnvVars ? 'Has' : 'No'} Custom Env Vars`);
            traceVerbose(`Activating Environment to capture Environment variables, ${command}`);

            // Do some wrapping of the call. For two reasons:
            // 1) Conda activate can hang on certain systems. Fail after 30 seconds.
            // See the discussion from hidesoon in this issue: https://github.com/Microsoft/vscode-python/issues/4424
            // His issue is conda never finishing during activate. This is a conda issue, but we
            // should at least tell the user.
            // 2) Retry because of this issue here: https://github.com/microsoft/vscode-python/issues/9244
            // This happens on AzDo machines a bunch when using Conda (and we can't dictate the conda version in order to get the fix)
            let result: ExecutionResult<string> | undefined;
            let tryCount = 1;
            let returnedEnv: NodeJS.ProcessEnv | undefined;
            while (!result) {
                try {
                    result = await processService.shellExec(command, {
                        env,
                        shell: shellInfo.shell,
                        timeout:
                            interpreter?.envType === EnvironmentType.Conda
                                ? CONDA_ENVIRONMENT_TIMEOUT
                                : ENVIRONMENT_TIMEOUT,
                        maxBuffer: 1000 * 1000,
                        throwOnStdErr: false,
                    });

                    try {
                        // Try to parse the output, even if we have errors in stderr, its possible they are false positives.
                        // If variables are available, then ignore errors (but log them).
                        returnedEnv = this.parseEnvironmentOutput(result.stdout, parse);
                    } catch (ex) {
                        if (!result.stderr) {
                            throw ex;
                        }
                    }
                    if (result.stderr) {
                        if (returnedEnv) {
                            traceWarn('Got env variables but with errors', result.stderr);
                        } else {
                            throw new Error(`StdErr from ShellExec, ${result.stderr} for ${command}`);
                        }
                    }
                } catch (exc) {
                    // Special case. Conda for some versions will state a file is in use. If
                    // that's the case, wait and try again. This happens especially on AzDo
                    const excString = (exc as Error).toString();
                    if (condaRetryMessages.find((m) => excString.includes(m)) && tryCount < 10) {
                        traceInfo(`Conda is busy, attempting to retry ...`);
                        result = undefined;
                        tryCount += 1;
                        await sleep(500);
                    } else {
                        throw exc;
                    }
                }
            }

            // Put back the PYTHONWARNINGS value
            if (oldWarnings && returnedEnv) {
                returnedEnv[PYTHON_WARNINGS] = oldWarnings;
            } else if (returnedEnv) {
                delete returnedEnv[PYTHON_WARNINGS];
            }
            return returnedEnv;
        } catch (e) {
            traceError('getActivatedEnvironmentVariables', e);
            sendTelemetryEvent(EventName.ACTIVATE_ENV_TO_GET_ENV_VARS_FAILED, undefined, {
                isPossiblyCondaEnv: interpreter?.envType === EnvironmentType.Conda,
                terminal: shellInfo.shellType,
            });

            // Some callers want this to bubble out, others don't
            if (allowExceptions) {
                throw e;
            }
        }
    }

    protected fixActivationCommands(commands: string[]): string[] {
        // Replace 'source ' with '. ' as that works in shell exec
        return commands.map((cmd) => cmd.replace(/^source\s+/, '. '));
    }
    @traceDecoratorError('Failed to parse Environment variables')
    @traceDecoratorVerbose('parseEnvironmentOutput', TraceOptions.None)
    protected parseEnvironmentOutput(output: string, parse: (out: string) => NodeJS.ProcessEnv | undefined) {
        if (output.indexOf(ENVIRONMENT_PREFIX) === -1) {
            return parse(output);
        }
        output = output.substring(output.indexOf(ENVIRONMENT_PREFIX) + ENVIRONMENT_PREFIX.length);
        const js = output.substring(output.indexOf('{')).trim();
        return parse(js);
    }
}
