/* eslint-disable global-require */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import TelemetryReporter from 'vscode-extension-telemetry/lib/telemetryReporter';

import { IWorkspaceService } from '../common/application/types';
import { AppinsightsKey, isTestExecution, isUnitTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import type { TerminalShellType } from '../common/terminal/types';
import { StopWatch } from '../common/utils/stopWatch';
import { isPromise } from '../common/utils/async';
import { EnvironmentType, PythonEnvironment } from '../pythonEnvironments/info';
import { EventName, PlatformErrors } from './constants';

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Within DA, there's a completely different way to send telemetry.
 * @returns {boolean}
 */
function isTelemetrySupported(): boolean {
    try {
        const vsc = require('vscode');
        const reporter = require('vscode-extension-telemetry');

        return vsc !== undefined && reporter !== undefined;
    } catch {
        return false;
    }
}

/**
 * Checks if the telemetry is disabled in user settings
 * @returns {boolean}
 */
export function isTelemetryDisabled(workspaceService: IWorkspaceService): boolean {
    const settings = workspaceService.getConfiguration('telemetry').inspect<boolean>('enableTelemetry')!;
    return settings.globalValue === false;
}

const sharedProperties: Record<string, unknown> = {};
/**
 * Set shared properties for all telemetry events.
 */
export function setSharedProperty<P extends ISharedPropertyMapping, E extends keyof P>(name: E, value?: P[E]): void {
    const propertyName = name as string;
    // Ignore such shared telemetry during unit tests.
    if (isUnitTestExecution() && propertyName.startsWith('ds_')) {
        return;
    }
    if (value === undefined) {
        delete sharedProperties[propertyName];
    } else {
        sharedProperties[propertyName] = value;
    }
}

/**
 * Reset shared properties for testing purposes.
 */
export function _resetSharedProperties(): void {
    for (const key of Object.keys(sharedProperties)) {
        delete sharedProperties[key];
    }
}

let telemetryReporter: TelemetryReporter | undefined;
function getTelemetryReporter() {
    if (!isTestExecution() && telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;

    const { extensions } = require('vscode') as typeof import('vscode');
    const extension = extensions.getExtension(extensionId)!;
    const extensionVersion = extension.packageJSON.version;

    const Reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    telemetryReporter = new Reporter(extensionId, extensionVersion, AppinsightsKey, true);

    return telemetryReporter;
}

export function clearTelemetryReporter(): void {
    telemetryReporter = undefined;
}

export function sendTelemetryEvent<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    measuresOrDurationMs?: Record<string, number> | number,
    properties?: P[E],
    ex?: Error,
): void {
    if (isTestExecution() || !isTelemetrySupported()) {
        return;
    }
    const reporter = getTelemetryReporter();
    const measures =
        typeof measuresOrDurationMs === 'number'
            ? { duration: measuresOrDurationMs }
            : measuresOrDurationMs || undefined;
    const customProperties: Record<string, string> = {};
    const eventNameSent = eventName as string;

    if (properties) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach((prop) => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            try {
                // If there are any errors in serializing one property, ignore that and move on.
                // Else nothing will be sent.
                switch (typeof data[prop]) {
                    case 'string':
                        customProperties[prop] = data[prop];
                        break;
                    case 'object':
                        customProperties[prop] = 'object';
                        break;
                    default:
                        customProperties[prop] = data[prop].toString();
                        break;
                }
            } catch (exception) {
                console.error(`Failed to serialize ${prop} for ${eventName}`, exception);
            }
        });
    }

    // Add shared properties to telemetry props (we may overwrite existing ones).
    Object.assign(customProperties, sharedProperties);

    if (ex) {
        const errorProps = {
            errorName: ex.name,
            errorMessage: ex.message,
            errorStack: ex.stack ?? '',
        };
        Object.assign(customProperties, errorProps);

        // To avoid hardcoding the names and forgetting to update later.
        const errorPropNames = Object.getOwnPropertyNames(errorProps);
        reporter.sendTelemetryErrorEvent(eventNameSent, customProperties, measures, errorPropNames);
    } else {
        reporter.sendTelemetryEvent(eventNameSent, customProperties, measures);
    }

    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        console.info(
            `Telemetry Event : ${eventNameSent} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(
                customProperties,
            )} `,
        );
    }
}

// Type-parameterized form of MethodDecorator in lib.es5.d.ts.
type TypedMethodDescriptor<T> = (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>,
) => TypedPropertyDescriptor<T> | void;

// The following code uses "any" in many places, as TS does not have rich support
// for typing decorators. Specifically, while it is possible to write types which
// encode the signature of the wrapped function, TS fails to actually infer the
// type of "this" and the signature at call sites, instead choosing to infer
// based on other hints (like the closure parameters), which ends up making it
// no safer than "any" (and sometimes misleading enough to be more unsafe).

/**
 * Decorates a method, sending a telemetry event with the given properties.
 * @param eventName The event name to send.
 * @param properties Properties to send with the event; must be valid for the event.
 * @param captureDuration True if the method's execution duration should be captured.
 * @param failureEventName If the decorated method returns a Promise and fails, send this event instead of eventName.
 * @param lazyProperties A static function on the decorated class which returns extra properties to add to the event.
 * This can be used to provide properties which are only known at runtime (after the decorator has executed).
 * @param lazyMeasures A static function on the decorated class which returns extra measures to add to the event.
 * This can be used to provide measures which are only known at runtime (after the decorator has executed).
 */
export function captureTelemetry<This, P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    properties?: P[E],
    captureDuration = true,
    failureEventName?: E,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lazyProperties?: (obj: This, result?: any) => P[E],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lazyMeasures?: (obj: This, result?: any) => Record<string, number>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): TypedMethodDescriptor<(this: This, ...args: any[]) => any> {
    return function (
        _target: unknown,
        _propertyKey: string | symbol,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        descriptor: TypedPropertyDescriptor<(this: This, ...args: any[]) => any>,
    ) {
        const originalMethod = descriptor.value!;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        descriptor.value = function (this: This, ...args: any[]) {
            // Legacy case; fast path that sends event before method executes.
            // Does not set "failed" if the result is a Promise and throws an exception.
            if (!captureDuration && !lazyProperties && !lazyMeasures) {
                sendTelemetryEvent(eventName, undefined, properties);

                return originalMethod.apply(this, args);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const getProps = (result?: any) => {
                if (lazyProperties) {
                    return { ...properties, ...lazyProperties(this, result) };
                }
                return properties;
            };

            const stopWatch = captureDuration ? new StopWatch() : undefined;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const getMeasures = (result?: any) => {
                const measures = stopWatch ? { duration: stopWatch.elapsedTime } : undefined;
                if (lazyMeasures) {
                    return { ...measures, ...lazyMeasures(this, result) };
                }
                return measures;
            };

            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            if (result && isPromise(result)) {
                result
                    .then((data) => {
                        sendTelemetryEvent(eventName, getMeasures(data), getProps(data));
                        return data;
                    })
                    .catch((ex) => {
                        const failedProps: P[E] = { ...getProps(), failed: true } as P[E] & FailedEventType;
                        sendTelemetryEvent(failureEventName || eventName, getMeasures(), failedProps, ex);
                    });
            } else {
                sendTelemetryEvent(eventName, getMeasures(result), getProps(result));
            }

            return result;
        };

        return descriptor;
    };
}

// function sendTelemetryWhenDone<T extends IDSMappings, K extends keyof T>(eventName: K, properties?: T[K]);
export function sendTelemetryWhenDone<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    promise: Promise<unknown> | Thenable<unknown>,
    stopWatch?: StopWatch,
    properties?: P[E],
): void {
    stopWatch = stopWatch || new StopWatch();
    if (typeof promise.then === 'function') {
        (promise as Promise<unknown>).then(
            (data) => {
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
            },
            (ex) => {
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            },
        );
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

/**
 * Map all shared properties to their data types.
 */
export interface ISharedPropertyMapping {
    /**
     * For every DS telemetry we would like to know the type of Notebook Editor used when doing something.
     */
    ['ds_notebookeditor']: undefined | 'old' | 'custom' | 'native';

    /**
     * For every telemetry event from the extension we want to make sure we can associate it with install
     * source. We took this approach to work around very limiting query performance issues.
     */
    ['installSource']: undefined | 'marketPlace' | 'pythonCodingPack';
}

type FailedEventType = { failed: true };

// Map all events to their properties
export interface IEventNamePropertyMapping {
    /**
     * Telemetry event sent with details of actions when invoking a diagnostic command
     */
    /* __GDPR__
       "diagnostics.action" : {
          "commandname" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karthiknadig" },
          "ignorecode" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karthiknadig" },
          "url" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karthiknadig" },
          "action" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karthiknadig" }
       }
     */
    [EventName.DIAGNOSTICS_ACTION]: {
        /**
         * Diagnostics command executed.
         * @type {string}
         */
        commandName?: string;
        /**
         * Diagnostisc code ignored (message will not be seen again).
         * @type {string}
         */
        ignoreCode?: string;
        /**
         * Url of web page launched in browser.
         * @type {string}
         */
        url?: string;
        /**
         * Custom actions performed.
         * @type {'switchToCommandPrompt'}
         */
        action?: 'switchToCommandPrompt';
    };
    /**
     * Telemetry event sent with details just after editor loads
     */
    /* __GDPR__
       "editor.load" : {
          "codeloadingtime" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "condaversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "errorname" : { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth", "owner": "luabud" },
          "errorstack" : { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth", "owner": "luabud" },
          "pythonversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "installsource" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "interpretertype" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "terminal" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "luabud" },
          "workspacefoldercount" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "haspython3" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "startactivatetime" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "totalactivatetime" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "totalnonblockingactivatetime" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "usinguserdefinedinterpreter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" },
          "usingglobalinterpreter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" }
       }
     */
    [EventName.EDITOR_LOAD]: {
        /**
         * The conda version if selected
         */
        condaVersion?: string | undefined;
        /**
         * The python interpreter version if selected
         */
        pythonVersion?: string | undefined;
        /**
         * The type of interpreter (conda, virtualenv, pipenv etc.)
         */
        interpreterType?: EnvironmentType | undefined;
        /**
         * The type of terminal shell created: powershell, cmd, zsh, bash etc.
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * Number of workspace folders opened
         */
        workspaceFolderCount: number;
        /**
         * If interpreters found for the main workspace contains a python3 interpreter
         */
        hasPython3?: boolean;
        /**
         * If user has defined an interpreter in settings.json
         */
        usingUserDefinedInterpreter?: boolean;
        /**
         * If global interpreter is being used
         */
        usingGlobalInterpreter?: boolean;
    };
    /**
     * Telemetry event sent when substituting Environment variables to calculate value of variables
     */
    /* __GDPR__
       "envfile_variable_substitution" : { "owner": "luabud" }
     */
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    /**
     * Telemetry event sent when an environment file is detected in the workspace.
     */
    /* __GDPR__
       "envfile_workspace" : {
          "hascustomenvpath" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" }
       }
     */

    [EventName.ENVFILE_WORKSPACE]: {
        /**
         * If there's a custom path specified in the python.envFile workspace settings.
         */
        hasCustomEnvPath: boolean;
    };
    /**
     * Telemetry Event sent when user sends code to be executed in the terminal.
     *
     */
    /* __GDPR__
       "execution_code" : {
          "scope" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "trigger" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.EXECUTION_CODE]: {
        /**
         * Whether the user executed a file in the terminal or just the selected text.
         *
         * @type {('file' | 'selection')}
         */
        scope: 'file' | 'selection';
        /**
         * How was the code executed (through the command or by clicking the `Run File` icon).
         *
         * @type {('command' | 'icon')}
         */
        trigger?: 'command' | 'icon';
    };
    /**
     * Telemetry event sent with details when tracking imports
     */
    /* __GDPR__
       "hashed_package_name" : {
          "hashedname" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" }
       }
     */

    [EventName.HASHED_PACKAGE_NAME]: {
        /**
         * Hash of the package name
         *
         * @type {string}
         */
        hashedName: string;
    };
    /* __GDPR__
       "hashed_package_perf" : {
          "propertyName" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "luabud" }
       }
     */
    [EventName.HASHED_PACKAGE_PERF]: never | undefined;
    /**
     * Telemetry event sent when installing modules
     */
    /* __GDPR__
       "python_install_package" : {
          "installer" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "requiredinstaller" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "productname" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "isinstalled" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "envtype" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "version" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */
    [EventName.PYTHON_INSTALL_PACKAGE]: {
        /**
         * The name of the module. (pipenv, Conda etc.)
         * One of the possible values includes `unavailable`, meaning user doesn't have pip, conda, or other tools available that can be used to install a python package.
         */
        installer: string;
        /**
         * The name of the installer required (expected to be available) for installation of pacakges. (pipenv, Conda etc.)
         */
        requiredInstaller?: string;
        /**
         * Name of the corresponding product (package) to be installed.
         */
        productName?: string;
        /**
         * Whether the product (package) has been installed or not.
         */
        isInstalled?: boolean;
        /**
         * Type of the Python environment into which the Python package is being installed.
         */
        envType?: PythonEnvironment['envType'];
        /**
         * Version of the Python environment into which the Python package is being installed.
         */
        version?: string;
    };
    /**
     * Telemetry event sent after fetching the OS version
     */
    /* __GDPR__
       "platform.info" : {
          "failuretype" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "luabud" },
          "osversion" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "luabud" }
       }
     */
    [EventName.PLATFORM_INFO]: {
        /**
         * If fetching OS version fails, list the failure type
         *
         * @type {PlatformErrors}
         */
        failureType?: PlatformErrors;
        /**
         * The OS version of the platform
         *
         * @type {string}
         */
        osVersion?: string;
    };
    /**
     * Telemetry event sent when 'Select Interpreter' command is invoked.
     */
    /* __GDPR__
       "select_interpreter" : {
           "duration" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true, "owner": "karrtikr" }
       }
     */
    [EventName.SELECT_INTERPRETER]: never | undefined;
    /**
     * Telemetry event sent with details after updating the python interpreter
     */
    /* __GDPR__
       "python_interpreter" : {
          "duration" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "trigger" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "failed" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" },
          "pythonversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.PYTHON_INTERPRETER]: {
        /**
         * Carries the source which triggered the update
         *
         * @type {('ui' | 'shebang' | 'load')}
         */
        trigger: 'ui' | 'shebang' | 'load';
        /**
         * Carries `true` if updating python interpreter failed
         *
         * @type {boolean}
         */
        failed: boolean;
        /**
         * The python version of the interpreter
         *
         * @type {string}
         */
        pythonVersion?: string;
    };
    /* __GDPR__
       "python_interpreter_activation_environment_variables" : {
          "hasenvvars" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "failed" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" }
       }
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATION_ENVIRONMENT_VARIABLES]: {
        /**
         * Carries `true` if environment variables are present, `false` otherwise
         *
         * @type {boolean}
         */
        hasEnvVars?: boolean;
        /**
         * Carries `true` if fetching environment variables failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
    };
    /**
     * Telemetry event sent when getting activation commands for active interpreter
     */
    /* __GDPR__
       "python_interpreter_activation_for_running_code" : {
          "hascommands" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "failed" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" },
          "terminal" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "pythonversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "interpretertype" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_RUNNING_CODE]: {
        /**
         * Carries `true` if activation commands exists for interpreter, `false` otherwise
         *
         * @type {boolean}
         */
        hasCommands?: boolean;
        /**
         * Carries `true` if fetching activation commands for interpreter failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
        /**
         * The type of terminal shell to activate
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * The Python interpreter version of the active interpreter for the resource
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The type of the interpreter used
         *
         * @type {EnvironmentType}
         */
        interpreterType: EnvironmentType;
    };
    /**
     * Telemetry event sent when getting activation commands for terminal when interpreter is not specified
     */
    /* __GDPR__
       "python_interpreter_activation_for_terminal" : {
          "hascommands" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "failed" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" },
          "terminal" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "pythonversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
          "interpretertype" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATION_FOR_TERMINAL]: {
        /**
         * Carries `true` if activation commands exists for terminal, `false` otherwise
         *
         * @type {boolean}
         */
        hasCommands?: boolean;
        /**
         * Carries `true` if fetching activation commands for terminal failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed?: boolean;
        /**
         * The type of terminal shell to activate
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
        /**
         * The Python interpreter version of the interpreter for the resource
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The type of the interpreter used
         *
         * @type {EnvironmentType}
         */
        interpreterType: EnvironmentType;
    };
    /**
     * Telemetry event sent when auto-selection is called.
     */
    /* __GDPR__
       "python_interpreter_auto_selection" : {
          "usecachedinterpreter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */

    [EventName.PYTHON_INTERPRETER_AUTO_SELECTION]: {
        /**
         * If auto-selection has been run earlier in this session, and this call returned a cached value.
         *
         * @type {boolean}
         */
        useCachedInterpreter?: boolean;
    };
    /**
     * Sends information regarding discovered python environments (virtualenv, conda, pipenv etc.)
     */
    /* __GDPR__
       "python_interpreter_discovery" : {
          "interpreters" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
       }
     */
    [EventName.PYTHON_INTERPRETER_DISCOVERY]: {
        /**
         * The number of the interpreters returned by locator
         */
        interpreters?: number;
    };
    /**
     * Telemetry event sent when pipenv interpreter discovery is executed.
     */
    /* __GDPR__
       "pipenv_interpreter_discovery" : {
          "duration" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */
    [EventName.PIPENV_INTERPRETER_DISCOVERY]: never | undefined;
    /**
     * Telemetry event sent with details when user clicks the prompt with the following message
     * `Prompt message` :- 'We noticed you're using a conda environment. If you are experiencing issues with this environment in the integrated terminal, we suggest the "terminal.integrated.inheritEnv" setting to be changed to false. Would you like to update this setting?'
     */
    /* __GDPR__
       "conda_inherit_env_prompt" : {
          "selection" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */
    [EventName.CONDA_INHERIT_ENV_PROMPT]: {
        /**
         * `Yes` When 'Yes' option is selected
         * `No` When 'No' option is selected
         * `More info` When 'More Info' option is selected
         */
        selection: 'Yes' | 'No' | 'More Info' | undefined;
    };
    /**
     * Telemetry event sent with details when user clicks a button in the virtual environment prompt.
     * `Prompt message` :- 'We noticed a new virtual environment has been created. Do you want to select it for the workspace folder?'
     */
    /* __GDPR__
       "python_interpreter_activate_environment_prompt" : {
          "selection" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */
    [EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT]: {
        /**
         * `Yes` When 'Yes' option is selected
         * `No` When 'No' option is selected
         * `Ignore` When 'Do not show again' option is clicked
         *
         * @type {('Yes' | 'No' | 'Ignore' | undefined)}
         */
        selection: 'Yes' | 'No' | 'Ignore' | undefined;
    };
    /**
     * Telemetry event sent with details when the user clicks a button in the "Python is not installed" prompt.
     * * `Prompt message` :- 'Python is not installed. Please download and install Python before using the extension.'
     */
    /* __GDPR__
       "python_not_installed_prompt" : {
          "selection" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
       }
     */
    [EventName.PYTHON_NOT_INSTALLED_PROMPT]: {
        /**
         * `Download` When the 'Download' option is clicked
         * `Ignore` When the prompt is dismissed
         *
         * @type {('Download' | 'Ignore' | undefined)}
         */
        selection: 'Download' | 'Ignore' | undefined;
    };
    /**
     * Telemetry event sent when starting REPL
     */
    /* __GDPR__
       "repl" : {
           "duration" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true, "owner": "karrtikr" }
       }
     */
    [EventName.REPL]: never | undefined;
    /**
     * Telemetry event sent when the extension is activated, if an active terminal is present and
     * the `python.terminal.activateEnvInCurrentTerminal` setting is set to `true`.
     */
    /* __GDPR__
       "activate_env_in_current_terminal" : {
          "isterminalvisible" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.ACTIVATE_ENV_IN_CURRENT_TERMINAL]: {
        /**
         * Carries boolean `true` if an active terminal is present (terminal is visible), `false` otherwise
         */
        isTerminalVisible?: boolean;
    };
    /**
     * Telemetry event sent with details when a terminal is created
     */
    /* __GDPR__
       "terminal.create" : {
         "terminal" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "triggeredby" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "pythonversion" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "interpretertype" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
       }
     */
    [EventName.TERMINAL_CREATE]: {
        /**
         * The type of terminal shell created: powershell, cmd, zsh, bash etc.
         *
         * @type {TerminalShellType}
         */
        terminal?: TerminalShellType;
        /**
         * The source which triggered creation of terminal
         *
         * @type {'commandpalette'}
         */
        triggeredBy?: 'commandpalette';
        /**
         * The default Python interpreter version to be used in terminal, inferred from resource's 'settings.json'
         *
         * @type {string}
         */
        pythonVersion?: string;
        /**
         * The Python interpreter type: Conda, Virtualenv, Venv, Pipenv etc.
         *
         * @type {EnvironmentType}
         */
        interpreterType?: EnvironmentType;
    };
    /*
    Telemetry event sent to provide information on whether we have successfully identify the type of shell used.
    This information is useful in determining how well we identify shells on users machines.
    This impacts executing code in terminals and activation of environments in terminal.
    So, the better this works, the better it is for the user.
    failed - If true, indicates we have failed to identify the shell. Note this impacts impacts ability to activate environments in the terminal & code.
    shellIdentificationSource - How was the shell identified. One of 'terminalName' | 'settings' | 'environment' | 'default'
                                If terminalName, then this means we identified the type of the shell based on the name of the terminal.
                                If settings, then this means we identified the type of the shell based on user settings in VS Code.
                                If environment, then this means we identified the type of the shell based on their environment (env variables, etc).
                                    I.e. their default OS Shell.
                                If default, then we reverted to OS defaults (cmd on windows, and bash on the rest).
                                    This is the worst case scenario.
                                    I.e. we could not identify the shell at all.
    terminalProvided - If true, we used the terminal provided to detec the shell. If not provided, we use the default shell on user machine.
    hasCustomShell - If undefined (not set), we didn't check.
                     If true, user has customzied their shell in VSC Settings.
    hasShellInEnv - If undefined (not set), we didn't check.
                    If true, user has a shell in their environment.
                    If false, user does not have a shell in their environment.
    */
    /* __GDPR__
      "terminal_shell_identification" : {
         "failed" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" },
         "terminalprovided" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "shellidentificationsource" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "hascustomshell" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" },
         "hasshellinenv" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "owner": "karrtikr" }
      }
    */
    [EventName.TERMINAL_SHELL_IDENTIFICATION]: {
        failed: boolean;
        terminalProvided: boolean;
        shellIdentificationSource: 'terminalName' | 'settings' | 'environment' | 'default' | 'vscode';
        hasCustomShell: undefined | boolean;
        hasShellInEnv: undefined | boolean;
    };
    /**
     * Telemetry event sent when getting environment variables for an activated environment has failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    /* __GDPR__
       "activate_env_to_get_env_vars_failed" : {
          "ispossiblycondaenv" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" },
          "terminal" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "owner": "karrtikr" }
       }
     */
    [EventName.ACTIVATE_ENV_TO_GET_ENV_VARS_FAILED]: {
        /**
         * Whether the activation commands contain the name `conda`.
         *
         * @type {boolean}
         */
        isPossiblyCondaEnv: boolean;
        /**
         * The type of terminal shell created: powershell, cmd, zsh, bash etc.
         *
         * @type {TerminalShellType}
         */
        terminal: TerminalShellType;
    };
}
