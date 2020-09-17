// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import { Memento } from 'vscode';
import { IExtensionActivationService } from '../../../activation/types';
import { IPythonApiProvider } from '../../../api/types';
import { GLOBAL_MEMENTO, IMemento, Resource } from '../../../common/types';
import { noop } from '../../../common/utils/misc';

const key = 'INTERPRETER_PATH_SELECTED_FOR_JUPYTER_SERVER';
const keySelected = 'INTERPRETER_PATH_WAS_SELECTED_FOR_JUPYTER_SERVER';
/**
 * Keeps track of whether the user ever selected an interpreter to be used as the global jupyter interpreter.
 * Keeps track of the interpreter path of the interpreter used as the global jupyter interpreter.
 *
 * @export
 * @class JupyterInterpreterStateStore
 */
@injectable()
export class JupyterInterpreterStateStore {
    private _interpreterPath?: string;
    constructor(@inject(IMemento) @named(GLOBAL_MEMENTO) private readonly memento: Memento) {}

    /**
     * Whether the user set an interpreter at least once (an interpreter for starting of jupyter).
     *
     * @readonly
     * @type {Promise<boolean>}
     */
    public get interpreterSetAtleastOnce(): boolean {
        return !!this.selectedPythonPath || this.memento.get<boolean>(keySelected, false);
    }
    public get selectedPythonPath(): string | undefined {
        return this._interpreterPath || this.memento.get<string | undefined>(key, undefined);
    }
    public updateSelectedPythonPath(value: string | undefined) {
        this._interpreterPath = value;
        this.memento.update(key, value).then(noop, noop);
        this.memento.update(keySelected, true).then(noop, noop);
    }
}

@injectable()
export class MigrateJupyterInterpreterStateService implements IExtensionActivationService {
    constructor(
        @inject(IPythonApiProvider) private readonly api: IPythonApiProvider,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private readonly memento: Memento
    ) {}

    // Migrate the interpreter path selected for Jupyter server from the Python extension's globalState memento
    public async activate(_resource: Resource) {
        if (!this.memento.get(key)) {
            this.api
                .getApi()
                .then(async (api) => {
                    const data = await api.getInterpreterPathSelectedForJupyterServer();
                    this.memento.update(key, data).then(noop, noop);
                    this.memento.update(keySelected, true).then(noop, noop);
                })
                .ignoreErrors();
        }
    }
}
