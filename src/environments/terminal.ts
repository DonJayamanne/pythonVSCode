// export class TerminalManager {
//     constructor() {}

import { commands, ExtensionContext, Terminal, window, workspace } from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as isWsl from 'is-wsl';
import { ITerminalHelper, TerminalShellType } from '../client/common/terminal/types';
import { sleep } from '../client/common/utils/async';
import { IServiceContainer } from '../client/ioc/types';
import { _SCRIPTS_DIR } from '../client/common/process/internal/scripts/constants';
import { StopWatch } from '../client/common/utils/stopWatch';
import { PythonEnvironment } from '../client/pythonEnvironments/info';
import { getHashString } from '../client/common/platform/fileSystem';
import { createTempFile } from './helpers';
import { traceError } from '../client/logging';

type WorkspaceFolderUri = string;
type EnvVars = { [key: string]: string | null };
const defaultEnvVars = new Map<WorkspaceFolderUri, EnvVars>();
export function activate(context: ExtensionContext, iocContainrer: IServiceContainer) {
    workspace.onDidChangeConfiguration(() => {
        // Any setting could cause env vars to get updated.
        // Lets not try to be too smart here.
        defaultEnvVars.clear();
    }, undefined, context.subscriptions);

    commands.registerCommand('python.envManager.openInTerminal', async (e: { env: PythonEnvironment }) => {
        const helper = iocContainrer.get<ITerminalHelper>(ITerminalHelper);
        // const activatedEnvVars = iocContainrer.get<IEnvironmentActivationService>(IEnvironmentActivationService);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // const env = { ...process.env } as any;
        const cwd = await pickFolder();
        // const condaEnvVars =
        //     (await e.env.envType) === EnvironmentType.Conda
        //         ? activatedEnvVars.getActivatedEnvironmentVariables(e.resource, e.env)
        //         : undefined;
        // if (e.env.envType === EnvironmentType.Conda && condaEnvVars) {
        //     const name = e.env.envName ? `Python ${e.env.envName}` : e.env.displayName;
        //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
        //     const terminal = window.createTerminal({ hideFromUser: true, name, env: condaEnvVars as any, cwd });
        //     terminal.show(false);
        // } else {
        // const pathName = getSearchPathEnvVarNames()[0];
        // env[pathName] = `${path.dirname(e.env.path)}${path.delimiter}${env[pathName]}`;

        const name = e.env.envName ? `Python ${e.env.envName}` : e.env.displayName;
        let terminal = window.createTerminal({ hideFromUser: true, name, cwd });
        const shell = helper.identifyTerminalShell(terminal);
        const activationCommands = await helper.getEnvironmentActivationCommands(shell, cwd, e.env);
        if (Array.isArray(activationCommands) && activationCommands.length > 0) {
            terminal.show(false);
            for (const command of activationCommands || []) {
                terminal.sendText(command);
                // No point sleeping if we have just one command.
                if (activationCommands.length > 1) {
                    await sleep(1_000);
                }
            }
            return;
        }
        if (isWsl) {
            // Using strict will not work, we'll need to update the Path variable with the terminal.
            const exportScript = await getPathScript(shell, e.env.path, context);
            terminal.dispose();
            terminal = window.createTerminal({
                hideFromUser: true,
                name,
                cwd
            });
            if (exportScript) {
                terminal.sendText(exportScript);
                await sleep(1_000);
            }
            terminal.show(false);
            return;
        }
        try {
            const [baseEnvVars, symlinkDir] = await Promise.all([
                getEmptyTerminalVariables(terminal, shell, cwd?.fsPath),
                createSymlink(shell, e.env.path, context),
            ]);
            terminal.dispose();
            const env = { ...baseEnvVars };
            // Windows seems to support both.
            ['Path', 'PATH'].forEach(pathVarName => {
                if (typeof env[pathVarName] === 'string') {
                    env[pathVarName] = `${symlinkDir}${path.delimiter}${env[pathVarName]}`;
                }
            });
            const terminalCustomEnvVars = window.createTerminal({
                hideFromUser: false,
                name,
                cwd,
                env,
                strictEnv: true,
            });
            terminalCustomEnvVars.show(false);
        } catch (ex) {
            console.error(`Failed to create terminal for ${e.env.envType}:${e.env.path}`, ex);
        }
    });
}

async function getEmptyTerminalVariables(terminal: Terminal, shell: TerminalShellType, workspaceFolderUri = ''): Promise<EnvVars | undefined> {
    if (defaultEnvVars.has(workspaceFolderUri)) {
        return defaultEnvVars.get(workspaceFolderUri)!;
    }
    const envFile = await createTempFile();
    const cmd = getEnvDumpCommand(shell, envFile.filePath);
    try {
        terminal.sendText(cmd.command);
        // Wait for the file to get created.
        const stopWatch = new StopWatch();
        while (stopWatch.elapsedTime < 5_000) {
            if (await fs.pathExists(envFile.filePath)) {
                break;
            }
            await sleep(100);
        }
        if (await fs.pathExists(envFile.filePath)) {
            const contents = await fs.readFile(envFile.filePath, 'utf8');
            const envVars = cmd.parser(contents);
            defaultEnvVars.set(workspaceFolderUri, envVars)
            return envVars;
        }
        traceError(`Env vars file not created command ${cmd.command}`);
        return;
    } catch (ex) {
        traceError(`Env vars file not created command ${cmd.command}`, ex);
        return;
    } finally {
        envFile.dispose();
    }
}
function getEnvDumpCommand(shell: TerminalShellType, envFile: string): { command: string, parser: (output: string) => EnvVars } {
    switch (shell) {
        case TerminalShellType.commandPrompt: {
            const parser = (output: string) => {
                const dict: EnvVars = {};
                output.split(/\r?\n/).forEach(line => {
                    if (line.indexOf('=') === -1) {
                        return;
                    }
                    const key = line.substring(0, line.indexOf('=')).trim();
                    const value = line.substring(line.indexOf('=') + 1).trim();
                    dict[key] = value;
                });
                return dict;
            };
            return { command: `set > "${envFile}"`, parser };
        }
        case TerminalShellType.powershell:
        case TerminalShellType.powershellCore: {
            const parser = (output: string) => {
                const dict: EnvVars = {};
                let startProcessing = false;
                output.split(/\r?\n/).forEach(line => {
                    if (line.startsWith('----')) {
                        startProcessing = true;
                        return;
                    }
                    if (!startProcessing) {
                        return;
                    }
                    const key = line.substring(0, line.indexOf(' ')).trim();
                    const value = line.substring(line.indexOf(' ') + 1).trim();
                    dict[key] = value;
                });
                return dict;
            };
            return { command: `Get-ChildItem env: | Out-File "${envFile}"`, parser };
        }
        default: {
            const parser = (output: string) => {
                const dict: EnvVars = {};
                output.split(/\r?\n/).forEach(line => {
                    if (line.indexOf('=') === -1) {
                        return;
                    }
                    const key = line.substring(0, line.indexOf('=')).trim();
                    const value = line.substring(line.indexOf('=') + 1).trim();
                    dict[key] = value;
                });
                return dict;
            };
            return { command: `printenv > "${envFile.replace(/\\/g, '/')}"`, parser };
        }
    }

}
async function createSymlink(shell: TerminalShellType, pythonPath: string, context: ExtensionContext) {
    const hash = getHashString(pythonPath);
    const script = createShellScript(shell, pythonPath);
    const symlinkDir = path.join(context.globalStorageUri.fsPath, 'symlinksV1', `python_${hash}`);
    const symlinkPythonFile = path.join(symlinkDir, `python${script.extension}`);
    const symlinkPipFile = path.join(symlinkDir, `pip${script.extension}`);
    if (await fs.pathExists(symlinkPythonFile)) {
        return symlinkDir;
    }
    await fs.ensureDir(symlinkDir);
    await Promise.all([fs.writeFile(symlinkPythonFile, script.python), fs.writeFile(symlinkPipFile, script.pip)]);
    await Promise.all([fs.chmod(symlinkPythonFile, 0o777), fs.chmod(symlinkPipFile, 0o777)]);
    return symlinkDir;
}

async function pickFolder() {
    if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
        return;
    }
    if (workspace.workspaceFolders.length === 1) {
        // eslint-disable-next-line consistent-return
        return workspace.workspaceFolders[0].uri;
    }

    return window.showWorkspaceFolderPick({ placeHolder: 'Select cwd for terminal' }).then((folder) => folder?.uri);
}

const envVariables = new Map<string, Promise<NodeJS.ProcessEnv>>();

export async function getActivatedEnvVariables(
    helper: ITerminalHelper,
    shell: TerminalShellType,
    terminal: Terminal,
    pythonPath: string,
): Promise<NodeJS.ProcessEnv> {
    if (envVariables.has(pythonPath)) {
        return envVariables.get(pythonPath)!;
    }
    const promise = (async () => {
        const tmpFile = await createTempFile();
        tmpFile.dispose();

        const args = helper.buildCommandForTerminal(shell, pythonPath, [
            path.join(_SCRIPTS_DIR, 'printEnvVariablesToFile.py'),
            tmpFile.filePath,
        ]);
        terminal.sendText(args);
        // Wait for the file to get created.
        const stopWatch = new StopWatch();
        while (stopWatch.elapsedTime < 5_000) {
            if (await fs.pathExists(tmpFile.filePath)) {
                break;
            }
            await sleep(100);
        }
        if (await fs.pathExists(tmpFile.filePath)) {
            try {
                return JSON.parse(await fs.readFile(tmpFile.filePath, 'utf8'));
            } catch (ex) {
                console.error(`Failed to parse activated env vars for ${pythonPath}, with command ${args}`, ex);
                throw new Error(`Failed to parse activated env vars for ${pythonPath}, with command ${args}`);
            }
        } else {
            throw new Error(`Failed to generate env vars for ${pythonPath}, with command ${args}`);
        }
    })();
    envVariables.set(pythonPath, promise);
    // So that we re-generate this everytime.
    // User can have custom env variables as well, caching will only break their stuff.
    promise.finally(() => envVariables.delete(pythonPath));
    return promise;
}

function createShellScript(shellType: TerminalShellType, realPath: string): { python: string; pip: string; extension: string } {
    switch (shellType) {
        case TerminalShellType.commandPrompt:
        case TerminalShellType.powershell:
        case TerminalShellType.powershellCore:
            // Powershell can run batch files.
            return {
                python: `
@ECHO off
"${realPath}"  %*
`,
                pip: `
@ECHO off
"${realPath}" -m pip  %*
`, extension: '.cmd'
            }

        default:
            // To my knowledge all shell apart from windows (cmd and ps) can run shell scripts.
            return {
                python: `#!/usr/bin/env bash
"${realPath}"   "$@"
ret=$?
exit $ret
`, pip: `#!/usr/bin/env bash
"${realPath}" -m pip   "$@"
ret=$?
exit $ret
`, extension: ''
            };
    }
}

async function getPathScript(shell: TerminalShellType, pythonPath: string, context: ExtensionContext) {
    const symlinkFolder = await createSymlink(shell, pythonPath, context);
    switch (shell) {
        case TerminalShellType.commandPrompt:
        case TerminalShellType.powershell:
        case TerminalShellType.powershellCore:
            return;

        default: {
            return `export "PATH=${symlinkFolder}${path.delimiter}$PATH" && clear`;
        }
    }
}
