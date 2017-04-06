/// <reference path="../../../node_modules/@types/node/index.d.ts" />
/// <reference path="../../../node_modules/vscode/vscode.d.ts" />

'use strict';
// TODO: Cleanup this place
// Add options for execPythonFile
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as settings from './configSettings';
import { CancellationToken, TextDocument, Range, Position } from 'vscode';
import { isNotInstalledError } from './helpers';
import { mergeEnvVariables, parseEnvFile } from './envFileParser';

export const IS_WINDOWS = /^win/.test(process.platform);
export const PATH_VARIABLE_NAME = IS_WINDOWS ? 'Path' : 'PATH';

const PathValidity: Map<string, boolean> = new Map<string, boolean>();
export function validatePath(filePath: string): Promise<string> {
    if (filePath.length === 0) {
        return Promise.resolve('');
    }
    if (PathValidity.has(filePath)) {
        return Promise.resolve(PathValidity.get(filePath) ? filePath : '');
    }
    return new Promise<string>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists ? filePath : '');
        });
    });
}
export function fsExistsAsync(filePath: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        fs.exists(filePath, exists => {
            PathValidity.set(filePath, exists);
            return resolve(exists);
        });
    });
}

let pythonInterpretterDirectory: string = null;
let previouslyIdentifiedPythonPath: string = null;
let customEnvVariables: any = null;

// If config settings change then clear env variables that we have cached
// Remember, the path to the python interpreter can change, hence we need to re-set the paths
settings.PythonSettings.getInstance().on('change', function () {
    customEnvVariables = null;
});

export function getPythonInterpreterDirectory(): Promise<string> {
    // If we already have it and the python path hasn't changed, yay
    if (pythonInterpretterDirectory && previouslyIdentifiedPythonPath === settings.PythonSettings.getInstance().pythonPath) {
        return Promise.resolve(pythonInterpretterDirectory);
    }

    return new Promise<string>(resolve => {
        let pythonFileName = settings.PythonSettings.getInstance().pythonPath;

        // Check if we have the path
        if (path.basename(pythonFileName) === pythonFileName) {
            // No path provided
            return resolve('');
        }

        // If we can execute the python, then get the path from the fully qualified name
        child_process.execFile(pythonFileName, ['-c', 'print(1234)'], (error, stdout, stderr) => {
            // Yes this is a valid python path
            if (stdout.startsWith('1234')) {
                return resolve(path.dirname(pythonFileName));
            }
            // No idea, didn't work, hence don't reject, but return empty path
            resolve('');
        });
    }).then(value => {
        // Cache and return
        previouslyIdentifiedPythonPath = settings.PythonSettings.getInstance().pythonPath;
        return pythonInterpretterDirectory = value;
    }).catch(() => {
        // Don't care what the error is, all we know is that this doesn't work
        return pythonInterpretterDirectory = '';
    });
}
export function getPathFromPythonCommand(args: string[]): Promise<string> {
    return execPythonFile(settings.PythonSettings.getInstance().pythonPath, args, __dirname).then(stdout => {
        if (stdout.length === 0) {
            return "";
        }
        let lines = stdout.split(/\r?\n/g).filter(line => line.length > 0);
        return validatePath(lines[0]);
    }).catch(() => {
        return "";
    });
}

export function execPythonFile(file: string, args: string[], cwd: string, includeErrorAsResponse: boolean = false, stdOut: (line: string) => void = null, token?: CancellationToken): Promise<string> {
    // If running the python file, then always revert to execFileInternal
    // Cuz python interpreter is always a file and we can and will always run it using child_process.execFile()
    if (file === settings.PythonSettings.getInstance().pythonPath) {
        if (stdOut) {
            return spawnFileInternal(file, args, { cwd }, includeErrorAsResponse, stdOut, token);
        }
        return execFileInternal(file, args, { cwd: cwd }, includeErrorAsResponse, token);
    }

    return getPythonInterpreterDirectory().then(pyPath => {
        // We don't have a path
        if (pyPath.length === 0) {
            if (stdOut) {
                return spawnFileInternal(file, args, { cwd }, includeErrorAsResponse, stdOut, token);
            }
            return execFileInternal(file, args, { cwd: cwd }, includeErrorAsResponse, token);
        }

        if (customEnvVariables === null) {
            customEnvVariables = getCustomEnvVars();
            customEnvVariables = customEnvVariables ? customEnvVariables : {};
            // Ensure to include the path of the current python 
            let newPath = '';
            let currentPath = typeof customEnvVariables[PATH_VARIABLE_NAME] === 'string' ? customEnvVariables[PATH_VARIABLE_NAME] : process.env[PATH_VARIABLE_NAME];
            if (IS_WINDOWS) {
                newPath = pyPath + '\\' + path.delimiter + path.join(pyPath, 'Scripts\\') + path.delimiter + currentPath;
                // This needs to be done for windows
                process.env[PATH_VARIABLE_NAME] = newPath;
            }
            else {
                newPath = pyPath + path.delimiter + currentPath;
            }
            customEnvVariables = mergeEnvVariables(customEnvVariables, process.env);
            customEnvVariables[PATH_VARIABLE_NAME] = newPath;
        }

        if (stdOut) {
            return spawnFileInternal(file, args, { cwd, env: customEnvVariables }, includeErrorAsResponse, stdOut, token);
        }
        return execFileInternal(file, args, { cwd, env: customEnvVariables }, includeErrorAsResponse, token);
    });
}

function handleResponse(file: string, includeErrorAsResponse: boolean, error: Error, stdout: string, stderr: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        if (isNotInstalledError(error)) {
            return reject(error);
        }

        // pylint:
        //      In the case of pylint we have some messages (such as config file not found and using default etc...) being returned in stderr
        //      These error messages are useless when using pylint   
        if (includeErrorAsResponse && (stdout.length > 0 || stderr.length > 0)) {
            return resolve(stdout + '\n' + stderr);
        }

        let hasErrors = (error && error.message.length > 0) || (stderr && stderr.length > 0);
        if (hasErrors && (typeof stdout !== 'string' || stdout.length === 0)) {
            let errorMsg = (error && error.message) ? error.message : (stderr && stderr.length > 0 ? stderr + '' : '');
            console.error('stdout');
            console.error(stdout);
            console.error('stderr');
            console.error(stderr);
            console.error('error');
            console.error(error);
            console.error('Over');
            return reject(errorMsg);
        }

        resolve(stdout + '');
    });
}
function execFileInternal(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean, token?: CancellationToken): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let proc = child_process.execFile(file, args, options, (error, stdout, stderr) => {
            handleResponse(file, includeErrorAsResponse, error, stdout, stderr).then(resolve, reject);
        });
        if (token && token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (proc) {
                    proc.kill();
                    proc = null;
                }
            });
        }
    });
}
function spawnFileInternal(file: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean, stdOut: (line: string) => void, token?: CancellationToken): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let proc = child_process.spawn(file, args, options);
        let error = '';
        let exited = false;
        if (token && token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (!exited && proc) {
                    proc.kill();
                    proc = null;
                }
            });
        }
        proc.on('error', error => {
            return reject(error);
        });
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
        proc.stdout.on('data', function (data: string) {
            if (token && token.isCancellationRequested) {
                return;
            }
            stdOut(data);
        });

        proc.stderr.on('data', function (data: string) {
            if (token && token.isCancellationRequested) {
                return;
            }
            if (includeErrorAsResponse) {
                stdOut(data);
            }
            else {
                error += data;
            }
        });

        proc.on('exit', function (code) {
            exited = true;

            if (token && token.isCancellationRequested) {
                return reject();
            }
            if (error.length > 0) {
                return reject(error);
            }

            resolve();
        });

    });
}
function execInternal(command: string, args: string[], options: child_process.ExecFileOptions, includeErrorAsResponse: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        child_process.exec([command].concat(args).join(' '), options, (error, stdout, stderr) => {
            handleResponse(command, includeErrorAsResponse, error, stdout, stderr).then(resolve, reject);
        });
    });
}

export function formatErrorForLogging(error: Error | string): string {
    let message: string = '';
    if (typeof error === 'string') {
        message = error;
    }
    else {
        if (error.message) {
            message = `Error Message: ${error.message}`;
        }
        if (error.name && error.message.indexOf(error.name) === -1) {
            message += `, (${error.name})`;
        }
        const innerException = (error as any).innerException;
        if (innerException && (innerException.message || innerException.name)) {
            if (innerException.message) {
                message += `, Inner Error Message: ${innerException.message}`;
            }
            if (innerException.name && innerException.message.indexOf(innerException.name) === -1) {
                message += `, (${innerException.name})`;
            }
        }
    }
    return message;
}

export function getSubDirectories(rootDir: string): Promise<string[]> {
    return new Promise<string[]>(resolve => {
        fs.readdir(rootDir, (error, files) => {
            if (error) {
                return resolve([]);
            }
            const subDirs = [];
            files.forEach(name => {
                const fullPath = path.join(rootDir, name);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        subDirs.push(fullPath);
                    }
                }
                catch (ex) {
                }
            });
            resolve(subDirs);
        });
    });
}

export function getCustomEnvVars(): any {
    const envFile = settings.PythonSettings.getInstance().envFile;
    if (typeof envFile === 'string' &&
        envFile.length > 0 &&
        fs.existsSync(envFile)) {

        try {
            let vars = parseEnvFile(envFile);
            if (vars && typeof vars === 'object' && Object.keys(vars).length > 0) {
                return vars;
            }
        }
        catch (ex) {
            console.error('Failed to load env file');
            console.error(ex);
            return null;
        }
    }
    return null;
}

export function getWindowsLineEndingCount(document:TextDocument, offset:Number)  {
    const eolPattern = new RegExp('\r\n', 'g');
    const readBlock = 1024;
    let count = 0;
    let offsetDiff = offset.valueOf();

    // In order to prevent the one-time loading of large files from taking up too much memory
    for (let pos = 0; pos < offset; pos += readBlock)   {
        let startAt = document.positionAt(pos)
        let endAt = null;
        
        if (offsetDiff >= readBlock) {
            endAt = document.positionAt(pos + readBlock);
            offsetDiff = offsetDiff - readBlock;
        } else {
            endAt = document.positionAt(pos + offsetDiff);
        }

        let text = document.getText(new Range(startAt, endAt));
        let cr = text.match(eolPattern);
        
        count += cr ? cr.length : 0;
    }
    return count;
}