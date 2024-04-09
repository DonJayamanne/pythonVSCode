// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IDefaultLanguageServer, IExtensions, DefaultLSType } from '../../common/types';
import { IServiceManager } from '../../ioc/types';
import { LanguageServerType } from '../types';

@injectable()
class DefaultLanguageServer implements IDefaultLanguageServer {
    public readonly defaultLSType: DefaultLSType;

    constructor(defaultServer: DefaultLSType) {
        this.defaultLSType = defaultServer;
    }
}

export function setDefaultLanguageServer(
    extensions: IExtensions,
    serviceManager: IServiceManager,
): void {
    const lsType = getDefaultLanguageServer(extensions);
    serviceManager.addSingletonInstance<IDefaultLanguageServer>(
        IDefaultLanguageServer,
        new DefaultLanguageServer(lsType),
    );
}

function getDefaultLanguageServer(extensions: IExtensions): DefaultLSType {
    if (extensions.getExtension(PYLANCE_EXTENSION_ID)) {
        return LanguageServerType.Node;
    }

    return LanguageServerType.Jedi;
}
