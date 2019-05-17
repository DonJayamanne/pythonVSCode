// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

export class StopWatch {
    private started = new Date().getTime();
    public get elapsedTime() {
        return new Date().getTime() - this.started;
    }
    public reset(){
        this.started = new Date().getTime();
    }
}
