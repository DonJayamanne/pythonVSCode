import { execPythonFile } from './../../common/utils';
import { CancellationToken, OutputChannel, window, workspace } from 'vscode';
import { getPythonInterpreterDirectory, IS_WINDOWS } from '../../common/utils';

let terminal = null;
export function run(file: string, args: string[], cwd: string, token?: CancellationToken, outChannel?: OutputChannel): Promise<string> {
    return execPythonFile(file, args, cwd, true, (data: string) => outChannel.append(data), token);

    // Bug, we cannot resolve this
    // Resolving here means that tests have completed
    // We need a way to determine that the tests have completed succefully.. hmm
    // We could use a hack, such as generating a textfile at the end of the command and monitoring.. hack hack hack
    // Or we could generate a shell script file and embed all of the hacks in here... hack hack hack...
    // return runTestInTerminal(file, args, cwd);
}

function runTestInTerminal(file: string, args: string[], cwd: string): Promise<any> {
    return getPythonInterpreterDirectory().then(pyPath => {
        let commands = [];
        if (IS_WINDOWS) {
            commands.push(`set PATH=%PATH%;${pyPath}`);
        }
        else {
            commands.push(`export PATH=$PATH:${pyPath}`);
        }
        if (cwd !== workspace.rootPath) {
            commands.push(`cd ${cwd}`);
        }
        commands.push(`${file} ${args.join(' ')}`);
        terminal = window.createTerminal(`Python Test Log`);

        return new Promise<any>((resolve) => {
            setTimeout(function () {
                terminal.show();
                terminal.sendText(commands.join(' && '));

                // Bug, we cannot resolve this
                // Resolving here means that tests have completed
                // We need a way to determine that the tests have completed succefully.. hmm
                resolve();
            }, 1000);
        });
    });
}