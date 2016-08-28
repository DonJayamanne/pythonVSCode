import {execPythonFile} from './../../common/utils';
import {CancellationToken, OutputChannel} from 'vscode';

export function run(file: string, args: string[], cwd: string, token?: CancellationToken, outChannel?: OutputChannel): Promise<string> {
    return execPythonFile(file, args, cwd, true, (data: string) => outChannel.append(data), token);
}