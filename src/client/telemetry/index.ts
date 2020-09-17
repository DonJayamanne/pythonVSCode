// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { JSONObject } from '@phosphor/coreutils';
import * as stackTrace from 'stack-trace';
// tslint:disable-next-line: import-name
import TelemetryReporter from 'vscode-extension-telemetry/lib/telemetryReporter';

import { DiagnosticCodes } from '../application/diagnostics/constants';
import { IWorkspaceService } from '../common/application/types';
import { AppinsightsKey, isTestExecution, isUnitTestExecution, PVSC_EXTENSION_ID } from '../common/constants';
import { traceError, traceInfo } from '../common/logger';
import { StopWatch } from '../common/utils/stopWatch';
import {
    JupyterCommands,
    NativeKeyboardCommandTelemetry,
    NativeMouseCommandTelemetry,
    Telemetry,
    VSCodeNativeTelemetry
} from '../datascience/constants';
import { ExportFormat } from '../datascience/export/types';
import { EventName, PlatformErrors } from './constants';

// tslint:disable: no-any

/**
 * Checks whether telemetry is supported.
 * Its possible this function gets called within Debug Adapter, vscode isn't available in there.
 * Within DA, there's a completely different way to send telemetry.
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

const sharedProperties: Record<string, any> = {};
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
    // tslint:disable-next-line:no-require-imports
    const extensions = (require('vscode') as typeof import('vscode')).extensions;
    const extension = extensions.getExtension(extensionId)!;
    const extensionVersion = extension.packageJSON.version;

    // tslint:disable-next-line:no-require-imports
    const reporter = require('vscode-extension-telemetry').default as typeof TelemetryReporter;
    return (telemetryReporter = new reporter(extensionId, extensionVersion, AppinsightsKey, true));
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
    let customProperties: Record<string, string> = {};
    let eventNameSent = eventName as string;

    if (ex) {
        // When sending telemetry events for exceptions no need to send custom properties.
        // Else we have to review all properties every time as part of GDPR.
        // Assume we have 10 events all with their own properties.
        // As we have errors for each event, those properties are treated as new data items.
        // Hence they need to be classified as part of the GDPR process, and thats unnecessary and onerous.
        eventNameSent = 'ERROR';
        customProperties = { originalEventName: eventName as string, stackTrace: serializeStackTrace(ex) };
        reporter.sendTelemetryErrorEvent(eventNameSent, customProperties, measures, []);
    } else {
        if (properties) {
            const data = properties as any;
            Object.getOwnPropertyNames(data).forEach((prop) => {
                if (data[prop] === undefined || data[prop] === null) {
                    return;
                }
                try {
                    // If there are any errors in serializing one property, ignore that and move on.
                    // Else nothing will be sent.
                    customProperties[prop] =
                        typeof data[prop] === 'string'
                            ? data[prop]
                            : typeof data[prop] === 'object'
                            ? 'object'
                            : data[prop].toString();
                } catch (ex) {
                    traceError(`Failed to serialize ${prop} for ${eventName}`, ex);
                }
            });
        }

        // Add shared properties to telemetry props (we may overwrite existing ones).
        Object.assign(customProperties, sharedProperties);

        // Remove shared DS properties from core extension telemetry.
        Object.keys(sharedProperties).forEach((shareProperty) => {
            if (
                customProperties[shareProperty] &&
                shareProperty.startsWith('ds_') &&
                !(eventNameSent.startsWith('DS_') || eventNameSent.startsWith('DATASCIENCE'))
            ) {
                delete customProperties[shareProperty];
            }
        });

        reporter.sendTelemetryEvent(eventNameSent, customProperties, measures);
    }

    if (process.env && process.env.VSC_PYTHON_LOG_TELEMETRY) {
        traceInfo(
            `Telemetry Event : ${eventNameSent} Measures: ${JSON.stringify(measures)} Props: ${JSON.stringify(
                customProperties
            )} `
        );
    }
}

// Type-parameterized form of MethodDecorator in lib.es5.d.ts.
type TypedMethodDescriptor<T> = (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;

/**
 * Decorates a method, sending a telemetry event with the given properties.
 * @param eventName The event name to send.
 * @param properties Properties to send with the event; must be valid for the event.
 * @param captureDuration True if the method's execution duration should be captured.
 * @param failureEventName If the decorated method returns a Promise and fails, send this event instead of eventName.
 * @param lazyProperties A static function on the decorated class which returns extra properties to add to the event.
 * This can be used to provide properties which are only known at runtime (after the decorator has executed).
 */
// tslint:disable-next-line:no-any function-name
export function captureTelemetry<This, P extends IEventNamePropertyMapping, E extends keyof P>(
    eventName: E,
    properties?: P[E],
    captureDuration: boolean = true,
    failureEventName?: E,
    lazyProperties?: (obj: This) => P[E]
): TypedMethodDescriptor<(this: This, ...args: any[]) => any> {
    // tslint:disable-next-line:no-function-expression no-any
    return function (
        _target: Object,
        _propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<(this: This, ...args: any[]) => any>
    ) {
        const originalMethod = descriptor.value!;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (this: This, ...args: any[]) {
            // Legacy case; fast path that sends event before method executes.
            // Does not set "failed" if the result is a Promise and throws an exception.
            if (!captureDuration && !lazyProperties) {
                sendTelemetryEvent(eventName, undefined, properties);
                // tslint:disable-next-line:no-invalid-this
                return originalMethod.apply(this, args);
            }

            const props = () => {
                if (lazyProperties) {
                    return { ...properties, ...lazyProperties(this) };
                }
                return properties;
            };

            const stopWatch = captureDuration ? new StopWatch() : undefined;

            // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
            const result = originalMethod.apply(this, args);

            // If method being wrapped returns a promise then wait for it.
            // tslint:disable-next-line:no-unsafe-any
            if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                // tslint:disable-next-line:prefer-type-cast
                (result as Promise<void>)
                    .then((data) => {
                        sendTelemetryEvent(eventName, stopWatch?.elapsedTime, props());
                        return data;
                    })
                    // tslint:disable-next-line:promise-function-async
                    .catch((ex) => {
                        // tslint:disable-next-line:no-any
                        const failedProps: P[E] = props() || ({} as any);
                        (failedProps as any).failed = true;
                        sendTelemetryEvent(
                            failureEventName ? failureEventName : eventName,
                            stopWatch?.elapsedTime,
                            failedProps,
                            ex
                        );
                    });
            } else {
                sendTelemetryEvent(eventName, stopWatch?.elapsedTime, props());
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
            (data) => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties);
                return data;
                // tslint:disable-next-line:promise-function-async
            },
            (ex) => {
                // tslint:disable-next-line:no-non-null-assertion
                sendTelemetryEvent(eventName, stopWatch!.elapsedTime, properties, ex);
                return Promise.reject(ex);
            }
        );
    } else {
        throw new Error('Method is neither a Promise nor a Theneable');
    }
}

function serializeStackTrace(ex: Error): string {
    // We aren't showing the error message (ex.message) since it might contain PII.
    let trace = '';
    for (const frame of stackTrace.parse(ex)) {
        const filename = frame.getFileName();
        if (filename) {
            const lineno = frame.getLineNumber();
            const colno = frame.getColumnNumber();
            trace += `\n\tat ${getCallsite(frame)} ${filename}:${lineno}:${colno}`;
        } else {
            trace += '\n\tat <anonymous>';
        }
    }
    // Ensure we always use `/` as path separators.
    // This way stack traces (with relative paths) coming from different OS will always look the same.
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
    return parts.join('.');
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

// Map all events to their properties
export interface IEventNamePropertyMapping {
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
         * Number of workspace folders opened
         */
        workspaceFolderCount: number;
    };
    /**
     * Telemetry event sent when substituting Environment variables to calculate value of variables
     */
    [EventName.ENVFILE_VARIABLE_SUBSTITUTION]: never | undefined;
    /**
     * Telemetry event sent when an environment file is detected in the workspace.
     */
    [EventName.ENVFILE_WORKSPACE]: {
        /**
         * If there's a custom path specified in the python.envFile workspace settings.
         */
        hasCustomEnvPath: boolean;
    };
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
    [Telemetry.HashedCellOutputMimeTypePerf]: never | undefined;
    [Telemetry.HashedNotebookCellOutputMimeTypePerf]: never | undefined;
    [Telemetry.HashedCellOutputMimeType]: {
        /**
         * Hash of the cell output mimetype
         *
         * @type {string}
         */
        hashedName: string;
        hasText: boolean;
        hasLatex: boolean;
        hasHtml: boolean;
        hasSvg: boolean;
        hasXml: boolean;
        hasJson: boolean;
        hasImage: boolean;
        hasGeo: boolean;
        hasPlotly: boolean;
        hasVega: boolean;
        hasWidget: boolean;
        hasJupyter: boolean;
        hasVnd: boolean;
    };
    [EventName.HASHED_PACKAGE_PERF]: never | undefined;
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
        /**
         * Whether the environment was activated within a terminal or not.
         *
         * @type {boolean}
         */
        activatedInTerminal?: boolean;
        /**
         * Whether the environment was activated by the wrapper class.
         * If `true`, this telemetry is sent by the class that wraps the two activation providers   .
         *
         * @type {boolean}
         */
        activatedByWrapper?: boolean;
    };
    /**
     * Telemetry event sent with details when user clicks a button in the following prompt
     * `Prompt message` :- 'We noticed you are using Visual Studio Code Insiders. Would you like to use the Insiders build of the Python extension?'
     */
    [EventName.INSIDERS_PROMPT]: {
        /**
         * `Yes, weekly` When user selects to use "weekly" as extension channel in insiders prompt
         * `Yes, daily` When user selects to use "daily" as extension channel in insiders prompt
         * `No, thanks` When user decides to keep using the same extension channel as before
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
     * Telemetry event sent with details when inExperiment() API is called
     */
    [EventName.PYTHON_EXPERIMENTS]: {
        /**
         * Name of the experiment group the user is in
         * @type {string}
         */
        expName?: string;
    };
    /**
     * Telemetry event sent when Experiments have been disabled.
     */
    [EventName.PYTHON_EXPERIMENTS_DISABLED]: never | undefined;
    /**
     * Telemetry event sent with details when a user has requested to opt it or out of an experiment group
     */
    [EventName.PYTHON_EXPERIMENTS_OPT_IN_OUT]: {
        /**
         * Carries the name of the experiment user has been opted into manually
         */
        expNameOptedInto?: string;
        /**
         * Carries the name of the experiment user has been opted out of manually
         */
        expNameOptedOutOf?: string;
    };
    /**
     * Telemetry event sent with details when doing best effort to download the experiments within timeout and using it in the current session only
     */
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
     * Telemetry sent back when join mailing list prompt is shown.
     */
    [EventName.JOIN_MAILING_LIST_PROMPT]: {
        /**
         * Carries the selection of user when they are asked to join the mailing list.
         */
        selection: 'Yes' | 'No' | undefined;
    };
    // Data Science
    [Telemetry.AddCellBelow]: never | undefined;
    [Telemetry.CodeLensAverageAcquisitionTime]: never | undefined;
    [Telemetry.CollapseAll]: never | undefined;
    [Telemetry.ConnectFailedJupyter]: never | undefined;
    [Telemetry.ConnectLocalJupyter]: never | undefined;
    [Telemetry.ConnectRemoteJupyter]: never | undefined;
    /**
     * Connecting to an existing Jupyter server, but connecting to localhost.
     */
    [Telemetry.ConnectRemoteJupyterViaLocalHost]: never | undefined;
    [Telemetry.ConnectRemoteFailedJupyter]: never | undefined;
    [Telemetry.ConnectRemoteSelfCertFailedJupyter]: never | undefined;
    [Telemetry.RegisterAndUseInterpreterAsKernel]: never | undefined;
    [Telemetry.UseInterpreterAsKernel]: never | undefined;
    [Telemetry.UseExistingKernel]: never | undefined;
    [Telemetry.SwitchToExistingKernel]: { language: string };
    [Telemetry.SwitchToInterpreterAsKernel]: never | undefined;
    [Telemetry.ConvertToPythonFile]: never | undefined;
    [Telemetry.CopySourceCode]: never | undefined;
    [Telemetry.CreateNewNotebook]: never | undefined;
    [Telemetry.DataScienceSettings]: JSONObject;
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
    /**
     * Telemetry sent to capture first time execution of a cell.
     * If `notebook = true`, this its telemetry for native editor/notebooks.
     */
    [Telemetry.ExecuteCellPerceivedCold]: undefined | { notebook: boolean };
    /**
     * Telemetry sent to capture subsequent execution of a cell.
     * If `notebook = true`, this its telemetry for native editor/notebooks.
     */
    [Telemetry.ExecuteCellPerceivedWarm]: undefined | { notebook: boolean };
    /**
     * Time take for jupyter server to start and be ready to run first user cell.
     */
    [Telemetry.PerceivedJupyterStartupNotebook]: never | undefined;
    /**
     * Time take for jupyter server to be busy from the time user first hit `run` cell until jupyter reports it is busy running a cell.
     */
    [Telemetry.StartExecuteNotebookCellPerceivedCold]: never | undefined;
    [Telemetry.ExecuteNativeCell]: never | undefined;
    [Telemetry.ExpandAll]: never | undefined;
    [Telemetry.ExportNotebookInteractive]: never | undefined;
    [Telemetry.ExportPythonFileInteractive]: never | undefined;
    [Telemetry.ExportPythonFileAndOutputInteractive]: never | undefined;
    [Telemetry.ClickedExportNotebookAsQuickPick]: { format: ExportFormat };
    [Telemetry.ExportNotebookAs]: { format: ExportFormat; cancelled?: boolean; successful?: boolean; opened?: boolean };
    [Telemetry.ExportNotebookAsCommand]: { format: ExportFormat };
    [Telemetry.ExportNotebookAsFailed]: { format: ExportFormat };
    [Telemetry.GetPasswordAttempt]: never | undefined;
    [Telemetry.GetPasswordFailure]: never | undefined;
    [Telemetry.GetPasswordSuccess]: never | undefined;
    [Telemetry.GotoSourceCode]: never | undefined;
    [Telemetry.HiddenCellTime]: never | undefined;
    [Telemetry.ImportNotebook]: { scope: 'command' | 'file' };
    [Telemetry.Interrupt]: never | undefined;
    [Telemetry.InterruptJupyterTime]: never | undefined;
    [Telemetry.NotebookRunCount]: { count: number };
    [Telemetry.NotebookWorkspaceCount]: { count: number };
    [Telemetry.NotebookOpenCount]: { count: number };
    [Telemetry.NotebookOpenTime]: number;
    [Telemetry.PandasNotInstalled]: never | undefined;
    [Telemetry.PandasTooOld]: never | undefined;
    [Telemetry.DebugpyInstallCancelled]: never | undefined;
    [Telemetry.DebugpyInstallFailed]: never | undefined;
    [Telemetry.DebugpyPromptToInstall]: never | undefined;
    [Telemetry.DebugpySuccessfullyInstalled]: never | undefined;
    [Telemetry.OpenNotebook]: { scope: 'command' | 'file' };
    [Telemetry.OpenNotebookAll]: never | undefined;
    [Telemetry.OpenedInteractiveWindow]: never | undefined;
    [Telemetry.OpenPlotViewer]: never | undefined;
    [Telemetry.Redo]: never | undefined;
    [Telemetry.RemoteAddCode]: never | undefined;
    [Telemetry.RemoteReexecuteCode]: never | undefined;
    [Telemetry.RestartJupyterTime]: never | undefined;
    [Telemetry.RestartKernel]: never | undefined;
    [Telemetry.RestartKernelCommand]: never | undefined;
    /**
     * Run Cell Commands in Interactive Python
     */
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
    /**
     * Cell Edit Commands in Interactive Python
     */
    [Telemetry.InsertCellBelowPosition]: never | undefined;
    [Telemetry.InsertCellBelow]: never | undefined;
    [Telemetry.InsertCellAbove]: never | undefined;
    [Telemetry.DeleteCells]: never | undefined;
    [Telemetry.SelectCell]: never | undefined;
    [Telemetry.SelectCellContents]: never | undefined;
    [Telemetry.ExtendSelectionByCellAbove]: never | undefined;
    [Telemetry.ExtendSelectionByCellBelow]: never | undefined;
    [Telemetry.MoveCellsUp]: never | undefined;
    [Telemetry.MoveCellsDown]: never | undefined;
    [Telemetry.ChangeCellToMarkdown]: never | undefined;
    [Telemetry.ChangeCellToCode]: never | undefined;
    [Telemetry.GotoNextCellInFile]: never | undefined;
    [Telemetry.GotoPrevCellInFile]: never | undefined;
    /**
     * Misc
     */
    [Telemetry.AddEmptyCellToBottom]: never | undefined;
    [Telemetry.RunCurrentCellAndAddBelow]: never | undefined;
    [Telemetry.CellCount]: { count: number };
    [Telemetry.Save]: never | undefined;
    [Telemetry.SelfCertsMessageClose]: never | undefined;
    [Telemetry.SelfCertsMessageEnabled]: never | undefined;
    [Telemetry.SelectJupyterURI]: never | undefined;
    [Telemetry.SelectLocalJupyterKernel]: never | undefined;
    [Telemetry.SelectRemoteJupyterKernel]: never | undefined;
    [Telemetry.SessionIdleTimeout]: never | undefined;
    [Telemetry.JupyterNotInstalledErrorShown]: never | undefined;
    [Telemetry.JupyterCommandSearch]: {
        where: 'activeInterpreter' | 'otherInterpreter' | 'path' | 'nowhere';
        command: JupyterCommands;
    };
    [Telemetry.UserInstalledJupyter]: never | undefined;
    [Telemetry.UserInstalledPandas]: never | undefined;
    [Telemetry.UserDidNotInstallJupyter]: never | undefined;
    [Telemetry.UserDidNotInstallPandas]: never | undefined;
    [Telemetry.SetJupyterURIToLocal]: never | undefined;
    [Telemetry.SetJupyterURIToUserSpecified]: never | undefined;
    [Telemetry.ShiftEnterBannerShown]: never | undefined;
    [Telemetry.ShowDataViewer]: { rows: number | undefined; columns: number | undefined };
    [Telemetry.CreateNewInteractive]: never | undefined;
    [Telemetry.StartJupyter]: never | undefined;
    [Telemetry.StartJupyterProcess]: never | undefined;
    /**
     * Telemetry event sent when jupyter has been found in interpreter but we cannot find kernelspec.
     *
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterInstalledButNotKernelSpecModule]: never | undefined;
    [Telemetry.JupyterStartTimeout]: {
        /**
         * Total time spent in attempting to start and connect to jupyter before giving up.
         *
         * @type {number}
         */
        timeout: number;
    };
    [Telemetry.SubmitCellThroughInput]: never | undefined;
    [Telemetry.Undo]: never | undefined;
    [Telemetry.VariableExplorerFetchTime]: never | undefined;
    [Telemetry.VariableExplorerToggled]: { open: boolean; runByLine: boolean };
    [Telemetry.VariableExplorerVariableCount]: { variableCount: number };
    [Telemetry.WaitForIdleJupyter]: never | undefined;
    [Telemetry.WebviewMonacoStyleUpdate]: never | undefined;
    [Telemetry.WebviewStartup]: { type: string };
    [Telemetry.WebviewStyleUpdate]: never | undefined;
    [Telemetry.RegisterInterpreterAsKernel]: never | undefined;
    /**
     * Telemetry sent when user selects an interpreter to start jupyter server.
     *
     * @type {(never | undefined)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.SelectJupyterInterpreterCommand]: never | undefined;
    [Telemetry.SelectJupyterInterpreter]: {
        /**
         * The result of the selection.
         * notSelected - No interpreter was selected.
         * selected - An interpreter was selected (and configured to have jupyter and notebook).
         * installationCancelled - Installation of jupyter and/or notebook was cancelled for an interpreter.
         *
         * @type {('notSelected' | 'selected' | 'installationCancelled')}
         */
        result?: 'notSelected' | 'selected' | 'installationCancelled';
    };
    [NativeKeyboardCommandTelemetry.ArrowDown]: never | undefined;
    [NativeKeyboardCommandTelemetry.ArrowUp]: never | undefined;
    [NativeKeyboardCommandTelemetry.ChangeToCode]: never | undefined;
    [NativeKeyboardCommandTelemetry.ChangeToMarkdown]: never | undefined;
    [NativeKeyboardCommandTelemetry.DeleteCell]: never | undefined;
    [NativeKeyboardCommandTelemetry.InsertAbove]: never | undefined;
    [NativeKeyboardCommandTelemetry.InsertBelow]: never | undefined;
    [NativeKeyboardCommandTelemetry.Redo]: never | undefined;
    [NativeKeyboardCommandTelemetry.Run]: never | undefined;
    [NativeKeyboardCommandTelemetry.RunAndAdd]: never | undefined;
    [NativeKeyboardCommandTelemetry.RunAndMove]: never | undefined;
    [NativeKeyboardCommandTelemetry.Save]: never | undefined;
    [NativeKeyboardCommandTelemetry.ToggleLineNumbers]: never | undefined;
    [NativeKeyboardCommandTelemetry.ToggleOutput]: never | undefined;
    [NativeKeyboardCommandTelemetry.Undo]: never | undefined;
    [NativeKeyboardCommandTelemetry.Unfocus]: never | undefined;
    [NativeMouseCommandTelemetry.AddToEnd]: never | undefined;
    [NativeMouseCommandTelemetry.ChangeToCode]: never | undefined;
    [NativeMouseCommandTelemetry.ChangeToMarkdown]: never | undefined;
    [NativeMouseCommandTelemetry.DeleteCell]: never | undefined;
    [NativeMouseCommandTelemetry.InsertBelow]: never | undefined;
    [NativeMouseCommandTelemetry.MoveCellDown]: never | undefined;
    [NativeMouseCommandTelemetry.MoveCellUp]: never | undefined;
    [NativeMouseCommandTelemetry.Run]: never | undefined;
    [NativeMouseCommandTelemetry.RunAbove]: never | undefined;
    [NativeMouseCommandTelemetry.RunAll]: never | undefined;
    [NativeMouseCommandTelemetry.RunBelow]: never | undefined;
    [NativeMouseCommandTelemetry.Save]: never | undefined;
    [NativeMouseCommandTelemetry.SelectKernel]: never | undefined;
    [NativeMouseCommandTelemetry.SelectServer]: never | undefined;
    [NativeMouseCommandTelemetry.ToggleVariableExplorer]: never | undefined;
    /**
     * Telemetry event sent once done searching for kernel spec and interpreter for a local connection.
     *
     * @type {{
     *         kernelSpecFound: boolean;
     *         interpreterFound: boolean;
     *     }}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.FindKernelForLocalConnection]: {
        /**
         * Whether a kernel spec was found.
         *
         * @type {boolean}
         */
        kernelSpecFound: boolean;
        /**
         * Whether an interpreter was found.
         *
         * @type {boolean}
         */
        interpreterFound: boolean;
        /**
         * Whether user was prompted to select a kernel spec.
         *
         * @type {boolean}
         */
        promptedToSelect?: boolean;
    };
    /**
     * Telemetry event sent when starting a session for a local connection failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.StartSessionFailedJupyter]: undefined | never;
    /**
     * Telemetry event fired if a failure occurs loading a notebook
     */
    [Telemetry.OpenNotebookFailure]: undefined | never;
    /**
     * Telemetry event sent to capture total time taken for completions list to be provided by LS.
     * This is used to compare against time taken by Jupyter.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.CompletionTimeFromLS]: undefined | never;
    /**
     * Telemetry event sent to capture total time taken for completions list to be provided by Jupyter.
     * This is used to compare against time taken by LS.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.CompletionTimeFromJupyter]: undefined | never;
    /**
     * Telemetry event sent to indicate the language used in a notebook
     *
     * @type { language: string }
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.NotebookLanguage]: {
        /**
         * Language found in the notebook if a known language. Otherwise 'unknown'
         */
        language: string;
    };
    /**
     * Telemetry event sent to indicate 'jupyter kernelspec' is not possible.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelSpecNotFound]: undefined | never;
    /**
     * Telemetry event sent to indicate registering a kernel with jupyter failed.
     *
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelRegisterFailed]: undefined | never;
    /**
     * Telemetry event sent to every time a kernel enumeration is done
     *
     * @type {...}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelEnumeration]: {
        /**
         * Count of the number of kernels found
         */
        count: number;
        /**
         * Boolean indicating if any are python or not
         */
        isPython: boolean;
        /**
         * Indicates how the enumeration was acquired.
         */
        source: 'cli' | 'connection';
    };
    /**
     * Total time taken to Launch a raw kernel.
     */
    [Telemetry.KernelLauncherPerf]: undefined | never;
    /**
     * Total time taken to find a kernel on disc.
     */
    [Telemetry.KernelFinderPerf]: undefined | never;
    /**
     * Telemetry event sent if there's an error installing a jupyter required dependency
     *
     * @type { product: string }
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterInstallFailed]: {
        /**
         * Product being installed (jupyter or ipykernel or other)
         */
        product: string;
    };
    /**
     * Telemetry event sent when installing a jupyter dependency
     *
     * @type {product: string}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.UserInstalledModule]: { product: string };
    /**
     * Telemetry event sent to when user customizes the jupyter command line
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.JupyterCommandLineNonDefault]: undefined | never;
    /**
     * Telemetry event sent when a user runs the interactive window with a new file
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.NewFileForInteractiveWindow]: undefined | never;
    /**
     * Telemetry event sent when a kernel picked crashes on startup
     * @type {(undefined | never)}
     * @memberof IEventNamePropertyMapping
     */
    [Telemetry.KernelInvalid]: undefined | never;
    [Telemetry.GatherIsInstalled]: undefined | never;
    [Telemetry.GatherCompleted]: {
        /**
         * result indicates whether the gather was completed to a script, notebook or suffered an internal error.
         */
        result: 'err' | 'script' | 'notebook' | 'unavailable';
    };
    [Telemetry.GatherStats]: {
        linesSubmitted: number;
        cellsSubmitted: number;
        linesGathered: number;
        cellsGathered: number;
    };
    [Telemetry.GatherException]: {
        exceptionType: 'activate' | 'gather' | 'log' | 'reset';
    };
    /**
     * Telemetry event sent when a gathered notebook has been saved by the user.
     */
    [Telemetry.GatheredNotebookSaved]: undefined | never;
    /**
     * Telemetry event sent when the user reports whether Gathered notebook was good or not
     */
    [Telemetry.GatherQualityReport]: { result: 'yes' | 'no' };
    /**
     * Telemetry event sent when the ZMQ native binaries do not work.
     */
    [Telemetry.ZMQNotSupported]: undefined | never;
    /**
     * Telemetry event sent when the ZMQ native binaries do work.
     */
    [Telemetry.ZMQSupported]: undefined | never;
    /**
     * Telemetry event sent with name of a Widget that is used.
     */
    [Telemetry.HashedIPyWidgetNameUsed]: {
        /**
         * Hash of the widget
         */
        hashedName: string;
        /**
         * Where did we find the hashed name (CDN or user environment or remote jupyter).
         */
        source?: 'cdn' | 'local' | 'remote';
        /**
         * Whether we searched CDN or not.
         */
        cdnSearched: boolean;
    };
    /**
     * Telemetry event sent with name of a Widget found.
     */
    [Telemetry.HashedIPyWidgetNameDiscovered]: {
        /**
         * Hash of the widget
         */
        hashedName: string;
        /**
         * Where did we find the hashed name (CDN or user environment or remote jupyter).
         */
        source?: 'cdn' | 'local' | 'remote';
    };
    /**
     * Total time taken to discover all IPyWidgets on disc.
     * This is how long it takes to discover a single widget on disc (from python environment).
     */
    [Telemetry.DiscoverIPyWidgetNamesLocalPerf]: never | undefined;
    /**
     * Something went wrong in looking for a widget.
     */
    [Telemetry.HashedIPyWidgetScriptDiscoveryError]: never | undefined;
    /**
     * Telemetry event sent when an ipywidget module loads. Module name is hashed.
     */
    [Telemetry.IPyWidgetLoadSuccess]: { moduleHash: string; moduleVersion: string };
    /**
     * Telemetry event sent when an ipywidget module fails to load. Module name is hashed.
     */
    [Telemetry.IPyWidgetLoadFailure]: {
        isOnline: boolean;
        moduleHash: string;
        moduleVersion: string;
        // Whether we timedout getting the source of the script (fetching script source in extension code).
        timedout: boolean;
    };
    /**
     * Telemetry event sent when an ipywidget version that is not supported is used & we have trapped this and warned the user abou it.
     */
    [Telemetry.IPyWidgetWidgetVersionNotSupportedLoadFailure]: { moduleHash: string; moduleVersion: string };
    /**
     * Telemetry event sent when an loading of 3rd party ipywidget JS scripts from 3rd party source has been disabled.
     */
    [Telemetry.IPyWidgetLoadDisabled]: { moduleHash: string; moduleVersion: string };
    /**
     * Total time taken to discover a widget script on CDN.
     */
    [Telemetry.DiscoverIPyWidgetNamesCDNPerf]: {
        // The CDN we were testing.
        cdn: string;
        // Whether we managed to find the widget on the CDN or not.
        exists: boolean;
    };
    /**
     * Telemetry sent when we prompt user to use a CDN for IPyWidget scripts.
     * This is always sent when we display a prompt.
     */
    [Telemetry.IPyWidgetPromptToUseCDN]: never | undefined;
    /**
     * Telemetry sent when user does somethign with the prompt displsyed to user about using CDN for IPyWidget scripts.
     */
    [Telemetry.IPyWidgetPromptToUseCDNSelection]: {
        selection: 'ok' | 'cancel' | 'dismissed' | 'doNotShowAgain';
    };
    /**
     * Telemetry event sent to indicate the overhead of syncing the kernel with the UI.
     */
    [Telemetry.IPyWidgetOverhead]: {
        totalOverheadInMs: number;
        numberOfMessagesWaitedOn: number;
        averageWaitTime: number;
        numberOfRegisteredHooks: number;
    };
    /**
     * Telemetry event sent when the widget render function fails (note, this may not be sufficient to capture all failures).
     */
    [Telemetry.IPyWidgetRenderFailure]: never | undefined;
    /**
     * Telemetry event sent when the widget tries to send a kernel message but nothing was listening
     */
    [Telemetry.IPyWidgetUnhandledMessage]: {
        msg_type: string;
    };

    // Telemetry send when we create a notebook for a raw kernel or jupyter
    [Telemetry.RawKernelCreatingNotebook]: never | undefined;
    [Telemetry.JupyterCreatingNotebook]: never | undefined;

    // Raw kernel timing events
    [Telemetry.RawKernelSessionConnect]: never | undefined;
    [Telemetry.RawKernelStartRawSession]: never | undefined;
    [Telemetry.RawKernelProcessLaunch]: never | undefined;

    // Raw kernel single events
    [Telemetry.RawKernelSessionStartSuccess]: never | undefined;
    [Telemetry.RawKernelSessionStartException]: never | undefined;
    [Telemetry.RawKernelSessionStartTimeout]: never | undefined;
    [Telemetry.RawKernelSessionStartUserCancel]: never | undefined;

    // Run by line events
    [Telemetry.RunByLineStart]: never | undefined;
    [Telemetry.RunByLineStep]: never | undefined;
    [Telemetry.RunByLineStop]: never | undefined;
    [Telemetry.RunByLineVariableHover]: never | undefined;

    // Trusted notebooks events
    [Telemetry.NotebookTrustPromptShown]: never | undefined;
    [Telemetry.TrustNotebook]: never | undefined;
    [Telemetry.TrustAllNotebooks]: never | undefined;
    [Telemetry.DoNotTrustNotebook]: never | undefined;

    // Native notebooks events
    [VSCodeNativeTelemetry.AddCell]: never | undefined;
    [VSCodeNativeTelemetry.DeleteCell]: never | undefined;
    [VSCodeNativeTelemetry.MoveCell]: never | undefined;
    [VSCodeNativeTelemetry.ChangeToCode]: never | undefined;
    [VSCodeNativeTelemetry.ChangeToMarkdown]: never | undefined;
    [VSCodeNativeTelemetry.RunAllCells]: never | undefined;
    [Telemetry.VSCNotebookCellTranslationFailed]: {
        isErrorOutput: boolean; // Whether we're trying to translate an error output when we shuldn't be.
    };
}
