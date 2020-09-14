import { inject, injectable } from 'inversify';
import { Resource } from '../../client/common/types';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IInterpreterQuickPickItem, IInterpreterSelector } from '../../client/interpreter/configuration/types';
import { IInterpreterService } from '../../client/interpreter/contracts';

@injectable()
export class InterpreterSelector implements IInterpreterSelector {
    constructor(@inject(IInterpreterService) private readonly interpreterService: IInterpreterService) {}

    public async getSuggestions(resource: Resource): Promise<IInterpreterQuickPickItem[]> {
        const interpreters = await this.interpreterService.getInterpreters(resource);
        return interpreters.map((item) => ({
            label: item.displayName || item.path,
            description: item.displayName || item.path,
            detail: item.displayName || item.path,
            path: item.path,
            interpreter: item
        }));
    }
}
