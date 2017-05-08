"use strict";

import * as Rx from 'rx';

export interface IJupyterClientAdapter {
}

export enum KernelCommand {
    shutdown, restart, interrupt
}
