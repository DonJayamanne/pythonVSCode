// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IServiceContainer } from '../../../ioc/types';
import { ConnectionInformation, HostPort, ISshFactory, ISshForwardingTunnelClient, ISshTunnel } from '../types';
import { SshForwardingTunnel } from './forwardingTunnel';
import { SshForwardingTunnelClient } from './forwardingTunnelClient';

@injectable()
export class SshFactory implements ISshFactory {
    constructor(@inject(IServiceContainer) private readonly serviceContainer: IServiceContainer) { }
    public async createForwardingTunnel(): Promise<ISshTunnel<ConnectionInformation>> {
        // return new SshForwardingTunnel(this.serviceContainer);
        return;
    }
    public async createForwardingTunnelChannel(): Promise<ISshForwardingTunnelClient> {
        // return new SshForwardingTunnelClient(this.serviceContainer);
        return;
    }
}
