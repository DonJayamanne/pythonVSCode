import { DebugSession } from 'vscode-debugadapter';
import { AttachRequestArguments, LaunchRequestArguments } from '../Common/Contracts';
import { IDebugLauncherScriptProvider } from '../types';
import { DebugClient } from './DebugClient';
import { DebuggerLauncherScriptProvider, NoDebugLauncherScriptProvider } from './launcherProvider';
import { LocalDebugClientV2 } from './localDebugClientV2';
import { NonDebugClientV2 } from './nonDebugClientV2';
import { RemoteDebugClient } from './RemoteDebugClient';

type DebugClientArgs = [LaunchRequestArguments, DebugSession, boolean, IDebugLauncherScriptProvider];
export function CreateLaunchDebugClient(launchRequestOptions: LaunchRequestArguments, debugSession: DebugSession, canLaunchTerminal: boolean): DebugClient<{}> {
    let launchScriptProvider: IDebugLauncherScriptProvider;
    const args: DebugClientArgs = [launchRequestOptions, debugSession, canLaunchTerminal, launchScriptProvider];
    if (launchRequestOptions.noDebug === true) {
        launchScriptProvider = new NoDebugLauncherScriptProvider();
        return new NonDebugClientV2(...args);
    } else {
        launchScriptProvider = new DebuggerLauncherScriptProvider();
        return new LocalDebugClientV2(...args);
    }
}
export function CreateAttachDebugClient(attachRequestOptions: AttachRequestArguments, debugSession: DebugSession): DebugClient<{}> {
    return new RemoteDebugClient(attachRequestOptions, debugSession);
}
