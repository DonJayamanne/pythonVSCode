// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable:no-reference no-any import-name no-any function-name
/// <reference path="./vscode-extension-telemetry.d.ts" />
import { JSONObject } from '@phosphor/coreutils';
import { basename as pathBasename, sep as pathSep } from 'path';
import * as stackTrace from 'stack-trace';
import TelemetryReporter from 'vscode-extension-telemetry';

import { DiagnosticCodes } from '../application/diagnostics/constants';
import { IWorkspaceService } from '../common/application/types';
import { AppinsightsKey, EXTENSION_ROOT_DIR, isTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { traceInfo } from '../common/logger';
import { TerminalShellType } from '../common/terminal/types';
import { StopWatch } from '../common/utils/stopWatch';
import { Telemetry } from '../datascience/constants';
import { DebugConfigurationType } from '../debugger/extension/types';
import { ConsoleType } from '../debugger/types';
import { AutoSelectionRule } from '../interpreter/autoSelection/types';
import { InterpreterType } from '../interpreter/contracts';
import { LinterId } from '../linters/types';
import { TestProvider } from '../testing/common/types';
import { EventName, PlatformErrors } from './constants';
import {
    LinterTrigger,
    TestTool
} from './types';

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Withiin DA, there's a completely different way to send telemetry.
 * @returns {boolean}
 */
function isTelemetrySupported(): boolean {
    try {
        // tslint:disable-next-line:no-require-imports
        const vsc = require('vscode');
        // tslint:disable-next-line:no-require-imports
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
    return settings.globalValue === false ? true : false;
}

let telemetryReporter: TelemetryReporter | undefined;
function getTelemetryReporter() {
    if (!isTestExecution() && telemetryReporter) {
        return telemetryReporter;
    }
    const extensionId = PVSC_EXTENSION_ID;
    // tslint:disable-next-line:no-require-imports
    const extensions = (require('vscode') as typeof import('vscode')).extensions;
    // tslint:disable-next-line:no-non-null-assertion
    const extension = extensions.getExtension(extensionId)!;
    // tslint:disable-next-line:no-unsafe-any
    const extensionVersion = extension.packageJSON.version;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return (telemetryReporter = new reporter(extensionId, extensionVersion, AppinsightsKey));
}

export function clearTelemetryReporter() {
    telemetryReporter = undefined;
}

export function sendTelemetryEvent<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    durationMs?: Record<string, number> | number,
    properties?: P[E],
    ex?: Error
) {
    if (isTestExecution() || !isTelemetrySupported()) {
        return;
    }
    const reporter = getTelemetryReporter();
    const measures = typeof durationMs === 'number' ? { duration: durationMs } : durationMs ? durationMs : undefined;

    if (ex && (eventName as any) !== 'ERROR') {
        // When sending `ERROR` telemetry event no need to send custom properties.
        // Else we have to review all properties every time as part of GDPR.
        // Assume we have 10 events all with their own properties.
        // As we have errors for each event, those properties are treated as new data items.
        // Hence they need to be classified as part of the GDPR process, and thats unnecessary and onerous.
        const props: Record<string, string> = {};
        props.stackTrace = getStackTrace(ex);
        props.originalEventName = eventName as any as string;
        reporter.sendTelemetryEvent('ERROR', props, measures);
    }
    const customProperties: Record<string, string> = {};
    if (properties) {
        // tslint:disable-next-line:prefer-type-cast no-any
        const data = properties as any;
        Object.getOwnPropertyNames(data).forEach(prop => {
            if (data[prop] === undefined || data[prop] === null) {
                return;
            }
            // tslint:disable-next-line:prefer-type-cast no-any  no-unsafe-any
            (customProperties as any)[prop] = typeof data[prop] === 'string' ? data[prop] : data[prop].toString();
        });
    }
    reporter.sendTelemetryEvent((eventName as any) as string, customProperties, measures);
    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        traceInfo(`Telemetry Event : ${eventName} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(customProperties)} `);
    }
}

// tslint:disable-next-line:no-any function-name
export function captureTelemetry<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    properties?: P[E],
    captureDuration: boolean = true,
    failureEventName?: E
) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_target: Object, _propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            if (!captureDuration) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }

            const stopWatch = new StopWatch();
            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then(data => {
                        sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
                    .catch(ex => {
                        // tslint:disable-next-line:no-any
                        properties = properties || ({} as any);
                        (properties as any).failed = true;
                        sendTelemetryEvent(
                            failureEventName ? failureEventName : eventName,
                            stopWatch.elapsedTime,
                            properties,
                            ex
                        );
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch.elapsedTime, properties);
            }

            return result;
        };

        return descriptor;
    };
}

// function sendTelemetryWhenDone<T extends IDSMappings, K extends keyof T>(eventName: K, properties?: T[K]);
export function sendTelemetryWhenDone<P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    promise: Promise<any> | Thenable<any>,
    stopWatch?: StopWatch,
    properties?: P[E]
) {
    stopWatch = stopWatch ? stopWatch : new StopWatch();
    if (typeof promise.then === 'function') {
        // tslint:disable-next-line:prefer-type-cast no-any
        (promise as Promise<any>).then(
            data => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            },
            ex => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            }
        );
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

function sanitizeFilename(filename: string): string {
    if (filename.startsWith(EXTENSION_ROOT_DIR)) {
        filename = `<pvsc>${filename.substring(EXTENSION_ROOT_DIR.length)}`;
    } else {
        // We don't really care about files outside our extension.
        filename = `<hidden>${pathSep}${pathBasename(filename)}`;
    }
    return filename;
}

function sanitizeName(name: string): string {
    if (name.indexOf('/') === -1 && name.indexOf('\\') === -1) {
        return name;
    } else {
        return '<hidden>';
    }
}

function getStackTrace(ex: Error): string {
    // We aren't showing the error message (ex.message) since it might
    // contain PII.
    let trace = '';
    for (const frame of stackTrace.parse(ex)) {
        let filename = frame.getFileName();
        if (filename) {
            filename = sanitizeFilename(filename);
            const lineno = frame.getLineNumber();
            const colno = frame.getColumnNumber();
            trace += `\n\tat ${getCallsite(frame)} ${filename}:${lineno}:${colno}`;
        } else {
            trace += '\n\tat <anonymous>';
        }
    }
    // Ensure we always use `/` as path seperators.
    // This way stack traces (with relative paths) comming from different OS will always look the same.
    return trace.trim().replace(/\\/g, '/');
}

function getCallsite(frame: stackTrace.StackFrame) {
    const parts: string[] = [];
    if (typeof frame.getTypeName() === 'string' && frame.getTypeName().length > 0) {
        parts.push(frame.getTypeName());
    }
    if (typeof frame.getMethodName() === 'string' && frame.getMethodName().length > 0) {
        parts.push(frame.getMethodName());
    }
    if (typeof frame.getFunctionName() === 'string' && frame.getFunctionName().length > 0) {
        if (parts.length !== 2 || parts.join('.') !== frame.getFunctionName()) {
            parts.push(frame.getFunctionName());
        }
    }
    return parts.map(sanitizeName).join('.');
}

// Map all events to their properties
export interface IEventNamePropertyMapping {
    /**
     * Telemetry event sent when providing completion items for the given position and document.
     */
    [EventName.COMPLETION]: never | undefined;
    /**
     * Telemetry event sent with details 'python.autoComplete.addBrackets' setting
     */
    [EventName.COMPLETION_ADD_BRACKETS]: {
        /**
         * Carries boolean `true` if 'python.autoComplete.addBrackets' is set to true, `false` otherwise
         */
        enabled: boolean;
    };
    /**
     * Telemetry captured when starting the debugger.
     */
    [EventName.DEBUGGER]: {
        /**
         * Trigger for starting the debugger.
         * - `launch`: Launch/start new code and debug it.
         * - `attach`: Attach to an exiting python process (remote debugging).
         * - `test`: Debugging python tests.
         *
         * @type {('launch' | 'attach' | 'test')}
         */
        trigger: 'launch' | 'attach' | 'test';
        /**
         * Type of console used.
         *  -`internalConsole`: Use VS Code debug console (no shells/terminals).
         * - `integratedTerminal`: Use VS Code terminal.
         * - `externalTerminal`: Use an External terminal.
         *
         * @type {ConsoleType}
         */
        console?: ConsoleType;
        /**
         * Whether user has defined environment variables.
         * Could have been defined in launch.json or the env file (defined in `settings.json`).
         * Default `env file` is `.env` in the workspace folder.
         *
         * @type {boolean}
         */
        hasEnvVars: boolean;
        /**
         * Whether there are any CLI arguments that need to be passed into the program being debugged.
         *
         * @type {boolean}
         */
        hasArgs: boolean;
        /**
         * Whether the user is debugging `django`.
         *
         * @type {boolean}
         */
        django: boolean;
        /**
         * Whether the user is debugging `flask`.
         *
         * @type {boolean}
         */
        flask: boolean;
        /**
         * Whether the user is debugging `jinja` templates.
         *
         * @type {boolean}
         */
        jinja: boolean;
        /**
         * Whether user is attaching to a local python program (attach scenario).
         *
         * @type {boolean}
         */
        isLocalhost: boolean;
        /**
         * Whether debugging a module.
         *
         * @type {boolean}
         */
        isModule: boolean;
        /**
         * Whether debugging with `sudo`.
         *
         * @type {boolean}
         */
        isSudo: boolean;
        /**
         * Whether required to stop upon entry.
         *
         * @type {boolean}
         */
        stopOnEntry: boolean;
        /**
         * Whether required to display return types in debugger.
         *
         * @type {boolean}
         */
        showReturnValue: boolean;
        /**
         * Whether debugging `pyramid`.
         *
         * @type {boolean}
         */
        pyramid: boolean;
        /**
         * Whether debugging a subprocess.
         *
         * @type {boolean}
         */
        subProcess: boolean;
        /**
         * Whether debugging `watson`.
         *
         * @type {boolean}
         */
        watson: boolean;
        /**
         * Whether degbugging `pyspark`.
         *
         * @type {boolean}
         */
        pyspark: boolean;
        /**
         * Whether using `gevent` when deugging.
         *
         * @type {boolean}
         */
        gevent: boolean;
        /**
         * Whether debugging `scrapy`.
         *
         * @type {boolean}
         */
        scrapy: boolean;
    };
    /**
     * Telemetry event sent when attaching to child process
     */
    [EventName.DEBUGGER_ATTACH_TO_CHILD_PROCESS]: never | undefined;
    /**
     * Telemetry sent after building configuration for debugger
     */
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS]: {
        /**
         * The type of debug configuration to build configuration fore
         *
         * @type {DebugConfigurationType}
         */
        configurationType: DebugConfigurationType;
        /**
         * Carries `true` if we are able to auto-detect manage.py path for Django, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedDjangoManagePyPath?: boolean;
        /**
         * Carries `true` if we are able to auto-detect .ini file path for Pyramid, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedPyramidIniPath?: boolean;
        /**
         * Carries `true` if we are able to auto-detect app.py path for Flask, `false` otherwise
         *
         * @type {boolean}
         */
        autoDetectedFlaskAppPyPath?: boolean;
        /**
         * Carries `true` if user manually entered the required path for the app
         * (path to `manage.py` for Django, path to `.ini` for Pyramid, path to `app.py` for Flask), `false` otherwise
         *
         * @type {boolean}
         */
        manuallyEnteredAValue?: boolean;
    };
    /**
     * Telemetry event sent when providing completion provider in launch.json. It is sent just *after* inserting the completion.
     */
    [EventName.DEBUGGER_CONFIGURATION_PROMPTS_IN_LAUNCH_JSON]: never | undefined;
    /**
     * Telemetry is sent when providing definitions for python code, particularly when [go to definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition)
     * and peek definition features are used.
     */
    [EventName.DEFINITION]: never | undefined;
    /**
     * Telemetry event sent with details of actions when invoking a diagnostic command
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
     * Telemetry event sent when we are checking if we can handle the diagnostic code
     */
    [EventName.DIAGNOSTICS_MESSAGE]: {
        /**
         * Code of diagnostics message detected and displayed.
         * @type {string}
         */
        code: DiagnosticCodes;
    };
    /**
     * Telemetry event sent with details just after editor loads
     */
    [EventName.EDITOR_LOAD]: {
        /**
         * The conda version if selected
         */
        condaVersion: string | undefined;
        /**
         * The python interpreter version if selected
         */
        pythonVersion: string | undefined;
        /**
         * The type of interpreter (conda, virtualenv, pipenv etc.)
         */
        interpreterType: InterpreterType | undefined;
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
        hasPython3: boolean;
        /**
         * If user has defined an interpreter in settings.json
         */
        usingUserDefinedInterpreter: boolean;
        /**
         * If interpreter is auto selected for the workspace
         */
        usingAutoSelectedWorkspaceInterpreter: boolean;
        /**
         * If global interpreter is being used
         */
        usingGlobalInterpreter: boolean;
    };
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    /**
     * Telemetry Event sent when user sends code to be executed in the terminal.
     *
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
     * Telemetry Event sent when user executes code against Django Shell.
     * Values sent:
     * scope
     *
     */
    [EventName.EXECUTION_DJANGO]: {
        /**
         * If `file`, then the file was executed in the django shell.
         * If `selection`, then the selected text was sent to the django shell.
         *
         * @type {('file' | 'selection')}
         */
        scope: 'file' | 'selection';
    };
    /**
     * Telemetry event sent with details when formatting a document
     */
    [EventName.FORMAT]: {
        /**
         * Tool being used to format
         */
        tool: 'autopep8' | 'black' | 'yapf';
        /**
         * If arguments for formatter is provided in resource settings
         */
        hasCustomArgs: boolean;
        /**
         * Carries `true` when formatting a selection of text, `false` otherwise
         */
        formatSelection: boolean;
    };
    /**
     * Telemetry event sent with the value of setting 'Format on type'
     */
    [EventName.FORMAT_ON_TYPE]: {
        /**
         * Carries `true` if format on type is enabled, `false` otherwise
         *
         * @type {boolean}
         */
        enabled: boolean;
    };
    /**
     * Telemetry event sent when sorting imports using formatter
     */
    [EventName.FORMAT_SORT_IMPORTS]: never | undefined;
    /**
     * Telemetry event sent when Go to Python object command is executed
     */
    [EventName.GO_TO_OBJECT_DEFINITION]: never | undefined;
    /**
     * Telemetry event sent when providing a hover for the given position and document for interactive window using Jedi.
     */
    [EventName.HOVER_DEFINITION]: never | undefined;
    /**
     * Telemetry event sent with details when tracking imports
     */
    [EventName.HASHED_PACKAGE_NAME]: {
        /**
         * Hash of the package name
         *
         * @type {string}
         */
        hashedName: string;
    };
    [EventName.HASHED_PACKAGE_PERF]: never | undefined;
    /**
     * Telemetry event sent with details of selection in prompt
     * `Prompt message` :- 'Linter ${productName} is not installed'
     */
    [EventName.LINTER_NOT_INSTALLED_PROMPT]: {
        /**
         * Name of the linter
         *
         * @type {LinterId}
         */
        tool?: LinterId;
        /**
         * `select` When 'Select linter' option is selected
         * `disablePrompt` When 'Do not show again' option is selected
         * `install` When 'Install' option is selected
         *
         * @type {('select' | 'disablePrompt' | 'install')}
         */
        action: 'select' | 'disablePrompt' | 'install';
    };
    /**
     * Telemetry event sent when installing modules
     */
    [EventName.PYTHON_INSTALL_PACKAGE]: {
        /**
         * The name of the module. (pipenv, Conda etc.)
         *
         * @type {string}
         */
        installer: string;
    };
    /**
     * Telemetry sent with details immediately after linting a document completes
     */
    [EventName.LINTING]: {
        /**
         * Name of the linter being used
         *
         * @type {LinterId}
         */
        tool: LinterId;
        /**
         * If custom arguments for linter is provided in settings.json
         *
         * @type {boolean}
         */
        hasCustomArgs: boolean;
        /**
         * Carries the source which triggered configuration of tests
         *
         * @type {LinterTrigger}
         */
        trigger: LinterTrigger;
        /**
         * Carries `true` if linter executable is specified, `false` otherwise
         *
         * @type {boolean}
         */
        executableSpecified: boolean;
    };
    /**
     * Telemetry event sent after fetching the OS version
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
     * Telemetry event sent with details after updating the python interpreter
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
        /**
         * The version of pip module installed in the python interpreter
         *
         * @type {string}
         */
        pipVersion?: string;
    };
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
         * @type {InterpreterType}
         */
        interpreterType: InterpreterType;
    };
    /**
     * Telemetry event sent when getting activation commands for terminal when interpreter is not specified
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
         * @type {InterpreterType}
         */
        interpreterType: InterpreterType;
    };
    [EventName.PYTHON_INTERPRETER_AUTO_SELECTION]: {
        /**
         * The rule used to auto-select the interpreter
         *
         * @type {AutoSelectionRule}
         */
        rule?: AutoSelectionRule;
        /**
         * If cached interpreter no longer exists or is invalid
         *
         * @type {boolean}
         */
        interpreterMissing?: boolean;
        /**
         * Carries `true` if next rule is identified for autoselecting interpreter
         *
         * @type {boolean}
         */
        identified?: boolean;
        /**
         * Carries `true` if cached interpreter is updated to use the current interpreter, `false` otherwise
         *
         * @type {boolean}
         */
        updated?: boolean;
    };
    /**
     * Sends information regarding discovered python environments (virtualenv, conda, pipenv etc.)
     */
    [EventName.PYTHON_INTERPRETER_DISCOVERY]: {
        /**
         * Name of the locator
         */
        locator: string;
        /**
         * The number of the interpreters returned by locator
         */
        interpreters?: number;
    };
    [EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT]: { selection: 'Yes' | 'No' | 'Ignore' | undefined };
    /**
     * Telemetry event sent with details when user clicks a button in the virtual environment prompt.
     * `Prompt message` :- 'We noticed a new virtual environment has been created. Do you want to select it for the workspace folder?'
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
    [EventName.INSIDERS_PROMPT]: {
        /**
         * @type {'Yes, weekly'} When user selects to use "weekly" as extension channel in insiders prompt
         * @type {'Yes, daily'} When user selects to use "daily" as extension channel in insiders prompt
         * @type {'No, thanks'} When user decides to keep using the same extension channel as before
         *
         * @type {('Yes, weekly' | 'Yes, daily' | 'No, thanks' | undefined)}
         */
        selection: 'Yes, weekly' | 'Yes, daily' | 'No, thanks' | undefined;
    };
    /**
     * Telemetry event sent with details when user clicks a button in the 'Reload to install insiders prompt'.
     * `Prompt message` :- 'Please reload Visual Studio Code to use the insiders build of the extension'
     */
    [EventName.INSIDERS_RELOAD_PROMPT]: {
        /**
         * `Reload` When 'Reload' option is clicked
         * `undefined` When prompt is closed
         *
         * @type {('Reload' | undefined)}
         */
        selection: 'Reload' | undefined;
    };
    /**
     * Telemetry tracking switching between LS and Jedi
     */
    [EventName.PYTHON_LANGUAGE_SERVER_SWITCHED]: {
        /**
         * Value of LS setting prior to switch.
         */
        oldValue: string;
        /**
         * Value of LS setting after switch.
         */
        newValue: string;
    };
    /**
     * Telemetry event sent with details after attempting to download LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_DOWNLOADED]: {
        /**
         * Whether LS downloading succeeds
         */
        success: boolean;
        /**
         * Version of LS downloaded
         */
        lsVersion?: string;
        /**
         * Whether download uri starts with `https:` or not
         */
        usedSSL?: boolean;
    };
    /**
     * Telemetry event sent when LS is started for workspace (workspace folder in case of multi-root)
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ENABLED]: never | undefined;
    /**
     * Telemetry event sent with details when downloading or extracting LS fails
     */
    [EventName.PYTHON_LANGUAGE_SERVER_ERROR]: {
        /**
         * The error associated with initializing language server
         */
        error: string;
    };
    /**
     * Telemetry event sent with details after attempting to extract LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_EXTRACTED]: {
        /**
         * Whether LS extracting succeeds
         */
        success: boolean;
        /**
         * Version of LS extracted
         */
        lsVersion?: string;
        /**
         * Whether download uri starts with `https:` or not
         */
        usedSSL?: boolean;
    };
    /**
     * Telemetry event sent if azure blob packages are being listed
     */
    [EventName.PYTHON_LANGUAGE_SERVER_LIST_BLOB_STORE_PACKAGES]: never | undefined;
    /**
     * Tracks if LS is supported on platform or not
     */
    [EventName.PYTHON_LANGUAGE_SERVER_PLATFORM_SUPPORTED]: {
        /**
         * Carries `true` if LS is supported, `false` otherwise
         *
         * @type {boolean}
         */
        supported: boolean;
        /**
         * If checking support for LS failed
         *
         * @type {'UnknownError'}
         */
        failureType?: 'UnknownError';
    };
    /**
     * Telemetry event sent when LS is ready to start
     */
    [EventName.PYTHON_LANGUAGE_SERVER_READY]: never | undefined;
    /**
     * Telemetry event sent when starting LS
     */
    [EventName.PYTHON_LANGUAGE_SERVER_STARTUP]: never | undefined;
    [EventName.PYTHON_LANGUAGE_SERVER_TELEMETRY]: any;
    [EventName.PYTHON_EXPERIMENTS]: {
        /**
         * Name of the experiment group the user is in
         * @type {string}
         */
        expName?: string;
    };
    [EventName.PYTHON_EXPERIMENTS_DOWNLOAD_SUCCESS_RATE]: {
        /**
         * Carries `true` if downloading experiments successfully finishes within timeout, `false` otherwise
         * @type {boolean}
         */
        success?: boolean;
        /**
         * Carries an error string if downloading experiments fails with error
         * @type {string}
         */
        error?: string;
    };
    /**
     * When user clicks a button in the python extension survey prompt, this telemetry event is sent with details
     */
    [EventName.EXTENSION_SURVEY_PROMPT]: {
        /**
         * Carries the selection of user when they are asked to take the extension survey
         */
        selection: 'Yes' | 'Maybe later' | 'Do not show again' | undefined;
    };
    /**
     * Telemetry event sent when 'Extract Method' command is invoked
     */
    [EventName.REFACTOR_EXTRACT_FUNCTION]: never | undefined;
    /**
     * Telemetry event sent when 'Extract Variable' command is invoked
     */
    [EventName.REFACTOR_EXTRACT_VAR]: never | undefined;
    /**
     * Telemetry event sent when providing an edit that describes changes to rename a symbol to a different name
     */
    [EventName.REFACTOR_RENAME]: never | undefined;
    /**
     * Telemetry event sent when providing a set of project-wide references for the given position and document
     */
    [EventName.REFERENCE]: never | undefined;
    /**
     * Telemetry event sent when starting REPL
     */
    [EventName.REPL]: never | undefined;
    /**
     * Telemetry event sent with details of linter selected in quickpick of linter list.
     */
    [EventName.SELECT_LINTER]: {
        /**
         * The name of the linter
         */
        tool?: LinterId;
        /**
         * Carries `true` if linter is enabled, `false` otherwise
         */
        enabled: boolean;
    };
    /**
     * Telemetry event sent with details when clicking the prompt with the following message,
     * `Prompt message` :- 'You have a pylintrc file in your workspace. Do you want to enable pylint?'
     */
    [EventName.CONFIGURE_AVAILABLE_LINTER_PROMPT]: {
        /**
         * Name of the linter tool
         *
         * @type {LinterId}
         */
        tool: LinterId;
        /**
         * `enable` When 'Enable [linter name]' option is clicked
         * `ignore` When 'Not now' option is clicked
         * `disablePrompt` When 'Do not show again` option is clicked
         *
         * @type {('enable' | 'ignore' | 'disablePrompt' | undefined)}
         */
        action: 'enable' | 'ignore' | 'disablePrompt' | undefined;
    };
    [EventName.SIGNATURE]: never | undefined;
    /**
     * Telemetry event sent when providing document symbol information for Jedi autocomplete intellisense
     */
    [EventName.SYMBOL]: never | undefined;
    /**
     * Telemetry event sent if and when user configure tests command. This command can be trigerred from multiple places in the extension. (Command palette, prompt etc.)
     */
    [EventName.UNITTEST_CONFIGURE]: never | undefined;
    /**
     * Telemetry event sent when user chooses a test framework in the Quickpick displayed for enabling and configuring test framework
     */
    [EventName.UNITTEST_CONFIGURING]: {
        /**
         * Name of the test framework to configure
         */
        tool?: TestTool;
        /**
         * Carries the source which triggered configuration of tests
         *
         * @type {('ui' | 'commandpalette')}
         */
        trigger: 'ui' | 'commandpalette';
        /**
         * Carries `true` if configuring test framework failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed: boolean;
    };
    /**
     * Telemetry event sent with details when a terminal is created
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
         * @type {InterpreterType}
         */
        interpreterType?: InterpreterType;
    };
    /**
     * Telemetry event sent with details about discovering tests
     */
    [EventName.UNITTEST_DISCOVER]: {
        /**
         * The test framework used to discover tests
         *
         * @type {TestTool}
         */
        tool: TestTool;
        /**
         * Carries the source which triggered discovering of tests
         *
         * @type {('ui' | 'commandpalette')}
         */
        trigger: 'ui' | 'commandpalette';
        /**
         * Carries `true` if discovering tests failed, `false` otherwise
         *
         * @type {boolean}
         */
        failed: boolean;
    };
    /**
     * Telemetry event is sent if we are doing test discovery using python code
     */
    [EventName.UNITTEST_DISCOVER_WITH_PYCODE]: never | undefined;
    /**
     * Telemetry event sent when user clicks a file, function, or suite in test explorer.
     */
    [EventName.UNITTEST_NAVIGATE]: {
        /**
         * Carries `true` if user clicks a file, `false` otherwise
         *
         * @type {boolean}
         */
        byFile?: boolean;
        /**
         * Carries `true` if user clicks a function, `false` otherwise
         *
         * @type {boolean}
         */
        byFunction?: boolean;
        /**
         * Carries `true` if user clicks a suite, `false` otherwise
         *
         * @type {boolean}
         */
        bySuite?: boolean;
        /**
         * Carries `true` if we are changing focus to the suite/file/function, `false` otherwise
         *
         * @type {boolean}
         */
        focus_code?: boolean;
    };
    /**
     * Tracks number of workspace folders shown in test explorer
     */
    [EventName.UNITTEST_EXPLORER_WORK_SPACE_COUNT]: { count: number };
    /**
     * Telemetry event sent with details about running the tests, what is being run, what framework is being used etc.
     */
    [EventName.UNITTEST_RUN]: {
        /**
         * Framework being used to run tests
         */
        tool: TestTool;
        /**
         * Carries info what is being run
         */
        scope: 'currentFile' | 'all' | 'file' | 'class' | 'function' | 'failed';
        /**
         * Carries `true` if debugging, `false` otherwise
         */
        debugging: boolean;
        /**
         * Carries what triggered the execution of the tests
         */
        triggerSource: 'ui' | 'codelens' | 'commandpalette' | 'auto' | 'testExplorer';
        /**
         * Carries `true` if running tests failed, `false` otherwise
         */
        failed: boolean;
    };
    /**
     * Telemetry event sent when cancelling running or discovering tests
     */
    [EventName.UNITTEST_STOP]: never | undefined;
    /**
     * Telemetry event sent when disabling all test frameworks
     */
    [EventName.UNITTEST_DISABLE]: never | undefined;
    /**
     * Telemetry event sent when viewing Python test log output
     */
    [EventName.UNITTEST_VIEW_OUTPUT]: never | undefined;
    /**
     * Tracks which testing framework has been enabled by the user.
     * Telemetry is sent when settings have been modified by the user.
     * Values sent include:
     * unittest -   If this value is `true`, then unittest has been enabled by the user.
     * pytest   -   If this value is `true`, then pytest has been enabled by the user.
     * nosetest -   If this value is `true`, then nose has been enabled by the user.
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [EventName.UNITTEST_ENABLED]: Partial<Record<TestProvider, undefined | boolean>>;
    /**
     * Telemetry sent when updating Pyspark library
     */
    [EventName.UPDATE_PYSPARK_LIBRARY]: never | undefined;
    /**
     * Telemetry sent when building workspace symbols
     */
    [EventName.WORKSPACE_SYMBOLS_BUILD]: never | undefined;
    /**
     * Telemetry sent when providing workspace symbols doing Project-wide search for a symbol matching the given query string
     */
    [EventName.WORKSPACE_SYMBOLS_GO_TO]: never | undefined;
    // Data Science
    [Telemetry.AddCellBelow]: never | undefined;
    [Telemetry.ClassConstructionTime]: { class: string };
    [Telemetry.CodeLensAverageAcquisitionTime]: never | undefined;
    [Telemetry.CollapseAll]: never | undefined;
    [Telemetry.ConnectFailedJupyter]: never | undefined;
    [Telemetry.ConnectLocalJupyter]: never | undefined;
    [Telemetry.ConnectRemoteJupyter]: never | undefined;
    [Telemetry.ConnectRemoteFailedJupyter]: never | undefined;
    [Telemetry.ConnectRemoteSelfCertFailedJupyter]: never | undefined;
    [Telemetry.CopySourceCode]: never | undefined;
    [Telemetry.DataScienceSettings]: JSONObject;
    [Telemetry.DataViewerFetchTime]: never | undefined;
    [Telemetry.DebugContinue]: never | undefined;
    [Telemetry.DebugCurrentCell]: never | undefined;
    [Telemetry.DebugStepOver]: never | undefined;
    [Telemetry.DebugStop]: never | undefined;
    [Telemetry.DebugFileInteractive]: never | undefined;
    [Telemetry.DeleteAllCells]: never | undefined;
    [Telemetry.DeleteCell]: never | undefined;
    [Telemetry.FindJupyterCommand]: { command: string };
    [Telemetry.FindJupyterKernelSpec]: never | undefined;
    [Telemetry.DisableInteractiveShiftEnter]: never | undefined;
    [Telemetry.EnableInteractiveShiftEnter]: never | undefined;
    [Telemetry.ExecuteCell]: never | undefined;
    [Telemetry.ExecuteCellPerceivedCold]: never | undefined;
    [Telemetry.ExecuteCellPerceivedWarm]: never | undefined;
    [Telemetry.ExpandAll]: never | undefined;
    [Telemetry.ExportNotebook]: never | undefined;
    [Telemetry.ExportPythonFile]: never | undefined;
    [Telemetry.ExportPythonFileAndOutput]: never | undefined;
    [Telemetry.GetPasswordAttempt]: never | undefined;
    [Telemetry.GetPasswordFailure]: never | undefined;
    [Telemetry.GetPasswordSuccess]: never | undefined;
    [Telemetry.GotoSourceCode]: never | undefined;
    [Telemetry.HiddenCellTime]: never | undefined;
    [Telemetry.ImportNotebook]: { scope: 'command' | 'file' };
    [Telemetry.Interrupt]: never | undefined;
    [Telemetry.InterruptJupyterTime]: never | undefined;
    [Telemetry.PandasNotInstalled]: never | undefined;
    [Telemetry.PandasTooOld]: never | undefined;
    [Telemetry.PtvsdInstallFailed]: never | undefined;
    [Telemetry.PtvsdPromptToInstall]: never | undefined;
    [Telemetry.PtvsdSuccessfullyInstalled]: never | undefined;
    [Telemetry.OpenPlotViewer]: never | undefined;
    [Telemetry.Redo]: never | undefined;
    [Telemetry.RemoteAddCode]: never | undefined;
    [Telemetry.RestartJupyterTime]: never | undefined;
    [Telemetry.RestartKernel]: never | undefined;
    [Telemetry.RunAllCells]: never | undefined;
    [Telemetry.RunSelectionOrLine]: never | undefined;
    [Telemetry.RunCell]: never | undefined;
    [Telemetry.RunCurrentCell]: never | undefined;
    [Telemetry.RunAllCellsAbove]: never | undefined;
    [Telemetry.RunCellAndAllBelow]: never | undefined;
    [Telemetry.RunCurrentCellAndAdvance]: never | undefined;
    [Telemetry.RunToLine]: never | undefined;
    [Telemetry.RunFileInteractive]: never | undefined;
    [Telemetry.RunFromLine]: never | undefined;
    [Telemetry.ScrolledToCell]: never | undefined;
    [Telemetry.SelfCertsMessageClose]: never | undefined;
    [Telemetry.SelfCertsMessageEnabled]: never | undefined;
    [Telemetry.SelectJupyterURI]: never | undefined;
    [Telemetry.SetJupyterURIToLocal]: never | undefined;
    [Telemetry.SetJupyterURIToUserSpecified]: never | undefined;
    [Telemetry.ShiftEnterBannerShown]: never | undefined;
    [Telemetry.ShowDataViewer]: { rows: number | undefined; columns: number | undefined };
    [Telemetry.ShowHistoryPane]: never | undefined;
    [Telemetry.StartJupyter]: never | undefined;
    [Telemetry.StartJupyterProcess]: never | undefined;
    [Telemetry.SubmitCellThroughInput]: never | undefined;
    [Telemetry.Undo]: never | undefined;
    [Telemetry.VariableExplorerFetchTime]: never | undefined;
    [Telemetry.VariableExplorerToggled]: { open: boolean };
    [Telemetry.VariableExplorerVariableCount]: { variableCount: number };
    [Telemetry.WaitForIdleJupyter]: never | undefined;
    [Telemetry.WebviewMonacoStyleUpdate]: never | undefined;
    [Telemetry.WebviewStartup]: { type: string };
    [Telemetry.WebviewStyleUpdate]: never | undefined;
    /*
    Telemetry event sent with details of Jedi Memory usage.
    mem_use - Memory usage of Process in kb.
    limit - Upper bound for memory usage of Jedi process.
    isUserDefinedLimit - Whether the user has configfured the upper bound limit.
    restart - Whether to restart the Jedi Process (i.e. memory > limit).
    */
    [EventName.JEDI_MEMORY]: { mem_use: number; limit: number; isUserDefinedLimit: boolean; restart: boolean };
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
    [EventName.TERMINAL_SHELL_IDENTIFICATION]: {
        failed: boolean;
        terminalProvided: boolean;
        shellIdentificationSource: 'terminalName' | 'settings' | 'environment' | 'default' | 'vscode';
        hasCustomShell: undefined | boolean;
        hasShellInEnv: undefined | boolean;
    };
}
