import * as os from 'os';
import { CancellationToken, debug, OutputChannel, workspace, Uri } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { execPythonFile } from './../../common/utils';
import { createDeferred } from './../../common/helpers';

const pythonSettings = PythonSettings.getInstance();
export function launchDebugger(rootDirectory: string, testArgs: string[], token?: CancellationToken, outChannel?: OutputChannel) {
    const def = createDeferred<any>();
    const launchDef = createDeferred<any>();
    let outputChannelShown = false;
    execPythonFile(pythonSettings.pythonPath, testArgs, rootDirectory, true, (data: string) => {
        if (data.startsWith('READY' + os.EOL)) {
            // debug socket server has started
            launchDef.resolve();
            data = data.substring(('READY' + os.EOL).length);
        }

        if (!outputChannelShown) {
            outputChannelShown = true;
            outChannel.show();
        }
        outChannel.append(data);
    }, token).catch(reason => {
        if (!def.rejected && !def.resolved) {
            def.reject(reason);
        }
    }).then(() => {
        if (!def.rejected && !def.resolved) {
            def.resolve();
        }
    }).catch(reason => {
        if (!def.rejected && !def.resolved) {
            def.reject(reason);
        }
    });

    launchDef.promise.then(() => {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            throw new Error('Please open a workspace');
        }
        let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(rootDirectory));
        if (!workspaceFolder) {
            workspaceFolder = workspace.workspaceFolders[0];
        }
        return debug.startDebugging(workspaceFolder, {
            "name": "Debug Unit Test",
            "type": "python",
            "request": "attach",
            "localRoot": rootDirectory,
            "remoteRoot": rootDirectory,
            "port": pythonSettings.unitTest.debugPort,
            "secret": "my_secret",
            "host": "localhost"
        });
    }).catch(reason => {
        if (!def.rejected && !def.resolved) {
            def.reject(reason);
        }
    });

    return def.promise;
}