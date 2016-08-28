import {execPythonFile} from './../../common/utils';
import {CancellationToken, OutputChannel, window} from 'vscode';
import {getPythonInterpreterDirectory} from '../../common/utils';

let terminal = null;
export function run(file: string, args: string[], cwd: string, token?: CancellationToken, outChannel?: OutputChannel): Promise<string> {
    // let cmd = '';
    // getPythonInterpreterDirectory().then(pyPath => {
    //     // Todo: Ability to run path using windows scripts (this works on mac - using bash)
    //     cmd = `export PATH=$PATH:${pyPath};${file} ${args.join(' ')}`;
    //     terminal = (<any>window).createTerminal(`Python Test Log`);
    //     setTimeout(function() {
    //         terminal.show();
    //         terminal.sendText(cmd);
    //     }, 1000);
    // });
    return execPythonFile(file, args, cwd, true, (data: string) => outChannel.append(data), token);
}