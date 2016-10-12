"use strict";

import * as net from "net";
import { PythonProcess } from "./pythonProcess";

export class Server {
    private socketServer: net.Server = null;
    constructor(private pythonProcess: PythonProcess) { }

    public Stop() {
        if (this.socketServer === null) return;
        try {
            this.socketServer.close();
        }
        catch (ex) { }
        this.socketServer = null;
    }

    public Start(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            let that = this;
            let connected = false;
            this.socketServer = net.createServer(c => {
                // "connection" listener
                c.on("data", (buffer: Buffer) => {
                    if (!connected) {
                        connected = that.pythonProcess.Connect(buffer, c);
                    }
                    else {
                        that.pythonProcess.HandleIncomingData(buffer);
                        //that.isRunning = true;
                    }
                });
                c.on("close", d => {
                    //that.emit("detach", d);
                });
                c.on("timeout", d => {
                    let msg = "Debugger client timedout, " + d;
                });
            });
            this.socketServer.on("error", ex => {
                let exMessage = JSON.stringify(ex);
                let msg = "";
                if ((ex as any).code === "EADDRINUSE") {
                    msg = `The port used for debugging is in use, please try again or try restarting Visual Studio Code, Error = ${exMessage}`;
                }
                else {
                    if (connected) {
                        return;
                    }
                    msg = `There was an error in starting the debug server. Error = ${exMessage}`;
                }
                reject(msg);
            });

            this.socketServer.listen(0, () => {
                let server = that.socketServer.address();
                resolve(server.port);
            });
        });
    }
}