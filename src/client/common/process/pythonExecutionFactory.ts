// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { gte } from 'semver';

import { Uri } from 'vscode';
import { IEnvironmentActivationService } from '../../interpreter/activation/types';
import { CondaEnvironmentInfo, ICondaService, IInterpreterService } from '../../interpreter/contracts';
import { WindowsStoreInterpreter } from '../../interpreter/locators/services/windowsStoreInterpreter';
import { IWindowsStoreInterpreter } from '../../interpreter/locators/types';
import { IServiceContainer } from '../../ioc/types';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import { IConfigurationService, IDisposable, IDisposableRegistry } from '../types';
import { ProcessService } from './proc';
import { PythonDaemonFactory } from './pythonDaemonFactory';
import { PythonDaemonExecutionServicePool } from './pythonDaemonPool';
import { createCondaEnv, createPythonEnv, createWindowsStoreEnv } from './pythonEnvironment';
import { createPythonProcessService } from './pythonProcess';
import {
    DaemonExecutionFactoryCreationOptions,
    ExecutionFactoryCreateWithEnvironmentOptions,
    ExecutionFactoryCreationOptions,
    IBufferDecoder,
    IProcessLogger,
    IProcessService,
    IProcessServiceFactory,
    IPythonDaemonExecutionService,
    IPythonExecutionFactory,
    IPythonExecutionService
} from './types';

// Minimum version number of conda required to be able to use 'conda run'
export const CONDA_RUN_VERSION = '4.6.0';

@injectable()
export class PythonExecutionFactory implements IPythonExecutionFactory {
    private readonly daemonsPerPythonService = new Map<string, Promise<IPythonDaemonExecutionService>>();
    constructor(
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
        @inject(IEnvironmentActivationService) private readonly activationHelper: IEnvironmentActivationService,
        @inject(IProcessServiceFactory) private readonly processServiceFactory: IProcessServiceFactory,
        @inject(IConfigurationService) private readonly configService: IConfigurationService,
        @inject(ICondaService) private readonly condaService: ICondaService,
        @inject(IBufferDecoder) private readonly decoder: IBufferDecoder,
        @inject(WindowsStoreInterpreter) private readonly windowsStoreInterpreter: IWindowsStoreInterpreter
    ) {}
    public async create(options: ExecutionFactoryCreationOptions): Promise<IPythonExecutionService> {
        const pythonPath = options.pythonPath
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = await this.processServiceFactory.create(options.resource);
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));

        return createPythonService(
            pythonPath,
            processService,
            this.serviceContainer.get<IFileSystem>(IFileSystem),
            undefined,
            this.windowsStoreInterpreter.isWindowsStoreInterpreter(pythonPath)
        );
    }

    public async createDaemon<T extends IPythonDaemonExecutionService | IDisposable>(
        options: DaemonExecutionFactoryCreationOptions
    ): Promise<T> {
        const pythonPath = options.pythonPath
            ? options.pythonPath
            : this.configService.getSettings(options.resource).pythonPath;
        const daemonPoolKey = `${pythonPath}#${options.daemonClass || ''}#${options.daemonModule || ''}`;
        const disposables = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        const interpreterService = this.serviceContainer.get<IInterpreterService>(IInterpreterService);
        const logger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);

        const interpreter = await interpreterService.getInterpreterDetails(pythonPath);
        const activatedProcPromise = this.createActivatedEnvironment({
            allowEnvironmentFetchExceptions: true,
            interpreter: interpreter,
            resource: options.resource,
            bypassCondaExecution: true
        });
        // No daemon support in Python 2.7.
        if (interpreter?.version && interpreter.version.major < 3) {
            return (activatedProcPromise! as unknown) as T;
        }

        const createDedicatedDaemon = 'dedicated' in options && options.dedicated;
        // Ensure we do not start multiple daemons for the same interpreter.
        // Cache the promise.
        const start = async (): Promise<T> => {
            const [activatedProc, activatedEnvVars] = await Promise.all([
                activatedProcPromise,
                this.activationHelper.getActivatedEnvironmentVariables(options.resource, interpreter, true)
            ]);

            if (createDedicatedDaemon) {
                const factory = new PythonDaemonFactory(
                    disposables,
                    { ...options, pythonPath },
                    activatedProc!,
                    activatedEnvVars
                );
                return factory.createDaemonService<T>();
            }
            const daemon = new PythonDaemonExecutionServicePool(
                logger,
                disposables,
                { ...options, pythonPath },
                activatedProc!,
                activatedEnvVars
            );
            await daemon.initialize();
            disposables.push(daemon);
            return (daemon as unknown) as T;
        };

        let promise: Promise<T>;

        if (createDedicatedDaemon) {
            promise = start();
        } else {
            // Ensure we do not create multiple daemon pools for the same python interpreter.
            promise = (this.daemonsPerPythonService.get(daemonPoolKey) as unknown) as Promise<T>;
            if (!promise) {
                promise = start();
                this.daemonsPerPythonService.set(daemonPoolKey, promise as Promise<IPythonDaemonExecutionService>);
            }
        }
        return promise.catch((ex) => {
            // Ok, we failed to create the daemon (or failed to start).
            // What ever the cause, we need to log this & give a standard IPythonExecutionService
            traceError('Failed to create the daemon service, defaulting to activated environment', ex);
            this.daemonsPerPythonService.delete(daemonPoolKey);
            return (activatedProcPromise as unknown) as T;
        });
    }
    public async createActivatedEnvironment(
        options: ExecutionFactoryCreateWithEnvironmentOptions
    ): Promise<IPythonExecutionService> {
        const envVars = await this.activationHelper.getActivatedEnvironmentVariables(
            options.resource,
            options.interpreter,
            options.allowEnvironmentFetchExceptions
        );
        const hasEnvVars = envVars && Object.keys(envVars).length > 0;
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES, undefined, { hasEnvVars });
        if (!hasEnvVars) {
            return this.create({
                resource: options.resource,
                pythonPath: options.interpreter ? options.interpreter.path : undefined
            });
        }
        const pythonPath = options.interpreter
            ? options.interpreter.path
            : this.configService.getSettings(options.resource).pythonPath;
        const processService: IProcessService = new ProcessService(this.decoder, { ...envVars });
        const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
        processService.on('exec', processLogger.logProcess.bind(processLogger));
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(processService);

        return createPythonService(pythonPath, processService, this.serviceContainer.get<IFileSystem>(IFileSystem));
    }
    // Not using this function for now because there are breaking issues with conda run (conda 4.8, PVSC 2020.1).
    // See https://github.com/microsoft/vscode-python/issues/9490
    public async createCondaExecutionService(
        pythonPath: string,
        processService?: IProcessService,
        resource?: Uri
    ): Promise<IPythonExecutionService | undefined> {
        const processServicePromise = processService
            ? Promise.resolve(processService)
            : this.processServiceFactory.create(resource);
        const [condaVersion, condaEnvironment, condaFile, procService] = await Promise.all([
            this.condaService.getCondaVersion(),
            this.condaService.getCondaEnvironment(pythonPath),
            this.condaService.getCondaFile(),
            processServicePromise
        ]);

        if (condaVersion && gte(condaVersion, CONDA_RUN_VERSION) && condaEnvironment && condaFile && procService) {
            // Add logging to the newly created process service
            if (!processService) {
                const processLogger = this.serviceContainer.get<IProcessLogger>(IProcessLogger);
                procService.on('exec', processLogger.logProcess.bind(processLogger));
                this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(procService);
            }
            return createPythonService(
                pythonPath,
                procService,
                this.serviceContainer.get<IFileSystem>(IFileSystem),
                // This is what causes a CondaEnvironment to be returned:
                [condaFile, condaEnvironment]
            );
        }

        return Promise.resolve(undefined);
    }
}

function createPythonService(
    pythonPath: string,
    procService: IProcessService,
    fs: IFileSystem,
    conda?: [string, CondaEnvironmentInfo],
    isWindowsStore?: boolean
): IPythonExecutionService {
    let env = createPythonEnv(pythonPath, procService, fs);
    if (conda) {
        const [condaPath, condaInfo] = conda;
        env = createCondaEnv(condaPath, condaInfo, pythonPath, procService, fs);
    } else if (isWindowsStore) {
        env = createWindowsStoreEnv(pythonPath, procService);
    }
    const procs = createPythonProcessService(procService, env);
    return {
        getInterpreterInformation: () => env.getInterpreterInformation(),
        getExecutablePath: () => env.getExecutablePath(),
        isModuleInstalled: (m) => env.isModuleInstalled(m),
        getExecutionInfo: (a) => env.getExecutionInfo(a),
        execObservable: (a, o) => procs.execObservable(a, o),
        execModuleObservable: (m, a, o) => procs.execModuleObservable(m, a, o),
        exec: (a, o) => procs.exec(a, o),
        execModule: (m, a, o) => procs.execModule(m, a, o)
    };
}
