import { BaseDebugServer } from "../DebugServers/BaseDebugServer";
import { RemoteDebugServer } from "../DebugServers/RemoteDebugServer";
import { IPythonProcess } from "../Common/Contracts";
import { DebugSession } from "vscode-debugadapter";
import { AttachRequestArguments } from "../Common/Contracts";
import { DebugClient, DebugType } from "./DebugClient";

export class RemoteDebugClient extends DebugClient {
    private args: AttachRequestArguments;
    constructor(args: any, debugSession: DebugSession) {
        super(args, debugSession);
        this.args = args;
    }

    private pythonProcess: IPythonProcess;
    private debugServer: BaseDebugServer;
    public CreateDebugServer(pythonProcess: IPythonProcess): BaseDebugServer {
        this.pythonProcess = pythonProcess;
        this.debugServer = new RemoteDebugServer(this.debugSession, this.pythonProcess, this.args);
        return this.debugServer;
    }
    public get DebugType(): DebugType {
        return DebugType.Remote;
    }

    public Stop() {
        if (this.pythonProcess) {
            this.pythonProcess.Detach();
        }
        if (this.debugServer) {
            this.debugServer.Stop();
            this.debugServer = null;
        }
    }

}
