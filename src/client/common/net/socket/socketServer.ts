import { EventEmitter } from 'events';
import { injectable } from 'inversify';
import * as net from 'net';
import { createDeferred, Deferred } from '../../../../utils/async';
import { noop } from '../../../../utils/misc';
import { ISocketServer } from '../../types';
import { HostPort } from '../types';

@injectable()
export class SocketServer extends EventEmitter implements ISocketServer {
    private socketServer: net.Server | undefined;
    private clientSocket: Deferred<net.Socket>;
    public get client(): Promise<net.Socket> {
        return this.clientSocket.promise;
    }
    constructor() {
        super();
        this.clientSocket = createDeferred<net.Socket>();
    }
    public dispose() {
        this.Stop();
    }
    public Stop() {
        if (!this.socketServer) { return; }
        try {
            this.socketServer.close();
            // tslint:disable-next-line:no-empty
        } catch (ex) { }
        this.socketServer = undefined;
    }

    public Start(options: Partial<HostPort> = {}): Promise<number> {
        const def = createDeferred<number>();
        this.socketServer = net.createServer(this.connectionListener.bind(this));

        const port = typeof options.port === 'number' ? options.port! : 0;
        const host = typeof options.host === 'string' ? options.host! : 'localhost';
        this.socketServer!.on('error', ex => {
            console.error('Error in Socket Server', ex);
            const msg = `Failed to start the socket server. (Error: ${ex.message})`;

            def.reject(msg);
        });
        this.socketServer!.listen({ port, host }, () => {
            def.resolve(this.socketServer!.address().port);
        });

        return def.promise;
    }
    public onConnect(listener: (client: net.Socket) => void): void {
        this.on('clientConnect', listener);
    }
    private connectionListener(client: net.Socket) {
        this.emit('clientConnect', client);
        if (!this.clientSocket.completed) {
            this.clientSocket.resolve(client);
        }
        client.on('close', () => {
            this.emit('close', client);
        });
        client.on('data', (data: Buffer) => {
            this.emit('data', client, data);
        });
        client.on('error', (err: Error) => noop);

        client.on('timeout', d => {
            // let msg = "Debugger client timedout, " + d;
        });
    }
}
