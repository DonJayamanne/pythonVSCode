// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
// tslint:disable-next-line: no-require-imports no-var-requires

export enum CursorPos {
    Top,
    Bottom,
    Current
}

// The state we are in for run by line debugging
export enum DebugState {
    Break,
    Design,
    Run
}

export enum ServerStatus {
    NotStarted = 'Not Started',
    Busy = 'Busy',
    Idle = 'Idle',
    Dead = 'Dead',
    Starting = 'Starting',
    Restarting = 'Restarting'
}
