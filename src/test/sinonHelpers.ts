// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as sinon from 'sinon';

export function createSub<T>(ctor: sinon.StubbableType<T>) {
    const stub = sinon.createStubInstance<T>(ctor);
    // tslint:disable-next-line:no-any
    (stub as any).object = stub;

    return stub as sinon.SinonStubbedInstance<T> & { object: T };
}
