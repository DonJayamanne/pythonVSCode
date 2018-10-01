// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Client } from 'ssh2';
import { createDeferred, Deferred } from '../../../../utils/async';
import { noop } from '../../../../utils/misc';
import { logError } from '../../logger';
import { ConnectionInformation, HostPort, ISshForwardingTunnelClient } from '../types';

export class SshForwardingTunnelClient extends EventEmitter implements ISshForwardingTunnelClient {
    protected sshClient: Client;
    private sourceAndDestination: Deferred<{ source: HostPort; destination: HostPort }>;
    constructor() {
        super();
        this.sourceAndDestination = createDeferred(this);
        this.initializeSshClient();
    }
    public close = () => this.dispose();
    public dispose() {
        try {
            this.sshClient.end();
        } catch { noop(); }
    }
    public async connect(connectionInfo: ConnectionInformation): Promise<void>{
        return;
    }
    public async bindToSocket(socket: Socket): Promise<void> {
        // Do not wait for promise, we need to perform some synchronizing in forwarding of ports.
        this.bindToSocketWhenReady(socket).ignoreErrors();
    }

    @logError('Error when forwarding the port')
    public async forwardPort(source: HostPort, destination: HostPort): Promise<void> {
        this.sourceAndDestination.resolve({ source, destination });
    }
    @logError('Error when binding to the Socket')
    protected async bindToSocketWhenReady(socket: Socket): Promise<void> {
        try {
            await this.waitForSshClient();
            const { source, destination } = await this.sourceAndDestination.promise;
            this.sshClient.forwardOut(source.host, source.port,
                destination.host, destination.port, (ex, channel) => {
                    if (ex) {
                        return this.emit('error', ex);
                    }

                    channel.on('error', error => {
                        this.emit('error', error);
                        this.emit('close');
                    });
                    socket.pipe(channel).pipe(socket);
                });
        } catch (ex) {
            this.emit('error', ex);
        }
    }

    protected initializeSshClient() {
        const sshClient = this.sshClient = new Client();
        sshClient.on('error', this.emit.bind(this, 'error'));
    }
    private waitForSshClient() {
        return new Promise(resolve => this.sshClient.on('ready', resolve));
    }
}
