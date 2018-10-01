// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Socket } from 'net';
import { Client, ClientChannel } from 'ssh2';
import { Disposable } from 'vscode';

export type ConnectionInformation = {
    credentials: {
        userName: string;
        password: string;
    };
    source: HostPort;
    destination?: Partial<HostPort>;
};

export type HostPort = { host: string; port: number };
export type ForwardTunnelInformation = {
    source: HostPort;
    destination: Partial<HostPort>;
};

export const ISshFactory = Symbol('ISshFactory');
export interface ISshFactory {
    createForwardingTunnel(connectionInfo: ConnectionInformation, source: HostPort, destination?: Partial<HostPort>): Promise<ISshForwardingTunnel>;
}

export interface ISshTunnel<T> extends Disposable {
    forwardPort(source: HostPort, destination: HostPort): Promise<void>;
    close(): void;
    /**
     * Starts the SSH Tunnel and returns the destination host and port.
     *
     * @returns {Promise<HostPort>}
     * @memberof ISshTunnel
     */
    connect(connectionInfo: T): Promise<HostPort>;
    /**
     * Event handler for when tunnel starts.
     * @param {('start')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any
    on(event: 'start', listener: (...args: any[]) => void): this;
    /**
     * Event handler for when tunnel closes.
     * @param {('close')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'close', listener: (...args: any[]) => void): this;
    /**
     * Event handler for when tunnel errors.
     * @param {('error')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'error', listener: (...args: any[]) => void): this;
    /**
     * Event handler for when something connects to the tunnel.
     * @param {('connect')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'connect', listener: (...args: any[]) => void): this;
    /**
     * Event handler for when data is sent over the tunnel.
     * @param {('data' | 'connect')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'data', listener: (...args: any[]) => void): this;
}

export const ISshForwardingTunnel = Symbol('ISshForwardingTunnel');
export interface ISshForwardingTunnel extends ISshTunnel<ConnectionInformation> { }

export interface ISshClient<T> extends Disposable {
    close(): void;
    connect(connectionInfo: T): Promise<void>;
}

export const ISshForwardingTunnelClient = Symbol('ISshForwardingTunnelChannel');
export interface ISshForwardingTunnelClient extends ISshClient<ConnectionInformation> {
    bindToSocket(socket: Socket): Promise<void>;
    forwardPort(source: HostPort, destination: HostPort): Promise<void>;
    /**
     * Event handler for when channel closes.
     * @param {('close')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'close', listener: (...args: any[]) => void): this;
    /**
     * Event handler for when channel errors.
     * @param {('error')} event
     * @param {(...args: any[]) => void} listener
     * @returns {this}
     * @memberof ISshTunnel
     */
    // tslint:disable-next-line:no-any unified-signatures
    on(event: 'error', listener: (...args: any[]) => void): this;
    connect(connectionInfo: ConnectionInformation): Promise<void>;
}
