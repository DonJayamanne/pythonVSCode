// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Client, ClientChannel } from 'ssh2';
import { createDeferred, Deferred } from '../../../../utils/async';
import { noop } from '../../../../utils/misc';
import { IServiceContainer } from '../../../ioc/types';
import { IDisposableRegistry, ISocketServer } from '../../types';
import { ConnectionInformation, HostPort, ISshForwardingTunnel, ISshForwardingTunnelClient } from '../types';

export class SshForwardingTunnel extends EventEmitter implements ISshForwardingTunnel {
    private socketServer?: ISocketServer;
    private clients: ISshForwardingTunnelClient[] = [];
    private sockets: Socket[] = [];
    private destination: Deferred<HostPort>;
    constructor(private readonly serviceContainer: IServiceContainer) {
        super();
        this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry).push(this);
        this.destination = createDeferred<HostPort>();
    }
    public forwardPort(source: HostPort, destination: HostPort): Promise<void> {
        return;
    }
    public async connect(connectionInfo: ConnectionInformation): Promise<HostPort> {
        // Using a tcp socket ass described below,
        // https://github.com/mscdex/ssh2/issues/40#issuecomment-30383609
        // https://github.com/mscdex/ssh2/issues/99#issuecomment-31871947
        const socketServer = this.socketServer = this.serviceContainer.get<ISocketServer>(ISocketServer);

        // We need to support more than one client connection.
        // Generally when debugger connects, that's it.
        // However, its possible we might want to check whether the debugger is reachable,
        // Or its possible we might want to keep the ssh connection alive for subsequent connections.
        // Either way, we shouldn't limit it to one connection, that's just unnecessary.
        const helper = this.serviceContainer.get<ISshForwardingTunnelClient>(ISshForwardingTunnelClient);
        helper.on('error', this.emit.bind(this, 'error'));
        helper.on('close', () => this.close());
        socketServer.onConnect(async socket => {
            try {
                await this.bindSocketToSshClient(socket, connectionInfo);
            } catch (ex) {
                this.emit('error', ex);
                this.close();
            }
        });

        const destination = { host: connectionInfo.destination.host || 'localhost', port: -1 };
        destination.port = await socketServer.Start();
        this.destination.resolve(destination);

        return connectionInfo.destination as HostPort;
    }
    public close = () => this.dispose();
    public dispose() {
        if (this.socketServer) {
            this.socketServer.dispose();
            this.socketServer = undefined;
        }

        this.sockets.forEach(socket => {
            try {
                socket.end();
            } catch { noop(); }
        });
        this.sockets = [];
        this.clients.forEach(client => {
            try {
                client.close();
            } catch { noop(); }
        });
        this.clients = [];
    }
    protected async bindSocketToSshClient(socket: Socket, connectionInfo: ConnectionInformation): Promise<void> {
        const destination = await this.destination.promise;
        try {
            this.sockets.push(socket);
            const sshClient = this.serviceContainer.get<ISshForwardingTunnelClient>(ISshForwardingTunnelClient);
            await sshClient.bindToSocket(socket);
            await sshClient.forwardPort(connectionInfo.source, destination);
            await sshClient.connect(connectionInfo);
        } catch (ex) {
            this.emit('error', ex);
            this.close();
        }
    }
}
