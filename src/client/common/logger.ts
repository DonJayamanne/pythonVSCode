// tslint:disable:no-console no-any
import { injectable } from 'inversify';

import * as fs from 'fs-extra';
import * as os from 'os';
import * as util from 'util';
import { sendTelemetryEvent } from '../telemetry';
import { isTestExecution } from './constants';
import { ILogger, LogLevel } from './types';

const PREFIX = 'Python Extension: ';
const consoleError = console.error;
const consoleWarn = console.warn;
const consoleInfo = console.info;

export function initialize() {
    if (process.env.VSC_PYTHON_LOG_FILE) {
        return;
    }
    // tslint:disable-next-line:no-function-expression
    console.log = function () {
        Logger.verbose.apply(Logger, arguments as any);
    };
    // tslint:disable-next-line:no-function-expression
    console.error = function () {
        Logger.error.apply(Logger, arguments as any);
    };
    // tslint:disable-next-line:no-function-expression
    console.warn = function () {
        Logger.warn.apply(Logger, arguments as any);
    };
    // tslint:disable-next-line:no-function-expression
    console.info = function () {
        Logger.verbose.apply(Logger, arguments as any);
    };
}

@injectable()
export class Logger implements ILogger {
    private skipLogging = false;
    private readonly logToFile: (...args: any[]) => void;
    constructor() {
        if (isTestExecution() && !process.env.VSC_PYTHON_FORCE_LOGGING) {
            this.skipLogging = true;
        }
        if (process.env.VSC_PYTHON_LOG_FILE) {
            this.skipLogging = false;
            this.logToFile = logToFile;
        } else {
            this.logToFile = () => {
                // Do nothing.
            };
        }
    }
    // tslint:disable-next-line:no-any
    public static error(...args: any[]) {
        new Logger().logError(...args);
    }
    // tslint:disable-next-line:no-any
    public static warn(...args: any[]) {
        new Logger().logWarning(...args);
    }
    // tslint:disable-next-line:no-any
    public static verbose(...args: any[]) {
        new Logger().logInformation(...args);
    }
    public logError(...args: any[]) {
        const message = formatArgs(args);
        if (!this.skipLogging) {
            consoleError(PREFIX, message);
        }
        this.logToFile(`Error: ${message}`);
    }
    public logWarning(...args: any[]) {
        const message = formatArgs(args);
        if (!this.skipLogging) {
            consoleWarn(PREFIX, message);
        }
        this.logToFile(`Warning: ${message}`);
    }
    public logInformation(...args: any[]) {
        const message = formatArgs(args);
        if (!this.skipLogging) {
            consoleInfo(PREFIX, formatArgs(args));
        }
        this.logToFile(`Information: ${message}`);
    }
}

let dataToLog: string[] = [];
let timer: NodeJS.Timer | undefined;
let busy = false;
function formatArgs(...args: any[]) {
    return util.format.apply(util.format, Array.prototype.slice.call(args) as any);
}

function logToFile(message: string) {
    dataToLog.push(message);
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(logData, 0);
}
async function logData() {
    if (busy || dataToLog.length === 0) {
        return;
    }
    // We need to preserve the order, hence we don't want multiple I/O threads writing to the same file at the same time.
    busy = true;
    const content = `${os.EOL}${dataToLog.join(os.EOL)}`;
    dataToLog = [];
    await fs.appendFile(process.env.VSC_PYTHON_LOG_FILE!, content).catch(() => {
        // Do nothing.
    });
    busy = false;
    if (dataToLog.length > 0) {
        timer = setTimeout(logData, 0);
    }
}

export enum LogOptions {
    None = 0,
    Arguments = 1,
    ReturnValue = 2
}

// tslint:disable-next-line:no-any
function argsToLogString(args: any[]): string {
    try {
        return (args || [])
            .map((item, index) => {
                if (item === undefined) {
                    return `Arg ${index + 1}: undefined`;
                }
                if (item === null) {
                    return `Arg ${index + 1}: null`;
                }
                try {
                    if (item && item.fsPath) {
                        return `Arg ${index + 1}: <Uri:${item.fsPath}>`;
                    }
                    return `Arg ${index + 1}: ${JSON.stringify(item)}`;
                } catch {
                    return `Arg ${index + 1}: <argument cannot be serialized for logging>`;
                }
            })
            .join(', ');
    } catch {
        return '';
    }
}

// tslint:disable-next-line:no-any
function returnValueToLogString(returnValue: any): string {
    const returnValueMessage = 'Return Value: ';
    if (returnValue === undefined) {
        return `${returnValueMessage}undefined`;
    }
    if (returnValue === null) {
        return `${returnValueMessage}null`;
    }
    try {
        return `${returnValueMessage}${JSON.stringify(returnValue)}`;
    } catch {
        return `${returnValueMessage}<Return value cannot be serialized for logging>`;
    }
}

export function traceVerbose(...args: any[]) {
    new Logger().logInformation(...args);
}

export function traceError(...args: any[]) {
    new Logger().logError(...args);
}

export function traceInfo(...args: any[]) {
    new Logger().logInformation(...args);
}

export function traceWarning(...args: any[]) {
    new Logger().logWarning(...args);
}

export namespace traceDecorators {
    export function verbose(message: string, options: LogOptions = LogOptions.Arguments | LogOptions.ReturnValue) {
        return trace(message, options);
    }
    export function error(message: string) {
        return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Error);
    }
    export function info(message: string) {
        return trace(message);
    }
    export function warn(message: string) {
        return trace(message, LogOptions.Arguments | LogOptions.ReturnValue, LogLevel.Warning);
    }
}
function trace(message: string, options: LogOptions = LogOptions.None, logLevel?: LogLevel) {
    // tslint:disable-next-line:no-function-expression no-any
    return function (_: Object, __: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        // tslint:disable-next-line:no-function-expression no-any
        descriptor.value = function (...args: any[]) {
            const className = _ && _.constructor ? _.constructor.name : '';
            // tslint:disable-next-line:no-any
            function writeSuccess(returnValue?: any) {
                if (logLevel === LogLevel.Error) {
                    return;
                }
                writeToLog(returnValue);
            }
            function writeError(ex: Error) {
                writeToLog(undefined, ex);
            }
            // tslint:disable-next-line:no-any
            function writeToLog(returnValue?: any, ex?: Error) {
                const messagesToLog = [message];
                messagesToLog.push(`Class name = ${className}`);
                if ((options && LogOptions.Arguments) === LogOptions.Arguments) {
                    messagesToLog.push(argsToLogString(args));
                }
                if ((options & LogOptions.ReturnValue) === LogOptions.ReturnValue) {
                    messagesToLog.push(returnValueToLogString(returnValue));
                }
                if (ex) {
                    new Logger().logError(messagesToLog.join(', '), ex);
                    sendTelemetryEvent('ERROR' as any, undefined, undefined, ex);
                } else {
                    new Logger().logInformation(messagesToLog.join(', '));
                }
            }
            try {
                // tslint:disable-next-line:no-invalid-this no-use-before-declare no-unsafe-any
                const result = originalMethod.apply(this, args);
                // If method being wrapped returns a promise then wait for it.
                // tslint:disable-next-line:no-unsafe-any
                if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
                    // tslint:disable-next-line:prefer-type-cast
                    (result as Promise<void>)
                        .then(data => {
                            writeSuccess(data);
                            return data;
                        })
                        .catch(ex => {
                            writeError(ex);
                        });
                } else {
                    writeSuccess(result);
                }
                return result;
            } catch (ex) {
                writeError(ex);
                throw ex;
            }
        };

        return descriptor;
    };
}
