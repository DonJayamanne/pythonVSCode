// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { once } from 'lodash';
import { CancellationToken, CodeLens, Command, Disposable, languages, Position, Range, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, PYTHON } from '../common/constants';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { containsTensorBoardImport } from './helpers';
import { TensorboardExperiment } from './tensorboarExperiment';

@injectable()
export class TensorBoardImportCodeLensProvider implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private sendTelemetryOnce = once(
        sendTelemetryEvent.bind(this, EventName.TENSORBOARD_ENTRYPOINT_SHOWN, undefined, {
            trigger: TensorBoardEntrypointTrigger.fileimport,
            entrypoint: TensorBoardEntrypoint.codelens,
        }),
    );

    private readonly disposables: IDisposable[] = [];

    constructor(
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(TensorboardExperiment) private readonly experiment: TensorboardExperiment,
    ) {
        disposables.push(this);
    }

    public dispose(): void {
        Disposable.from(...this.disposables).dispose();
    }

    public async activate(): Promise<void> {
        if (TensorboardExperiment.isTensorboardExtensionInstalled) {
            return;
        }
        this.experiment.disposeOnInstallingTensorboard(this);
        this.activateInternal().ignoreErrors();
    }

    // eslint-disable-next-line class-methods-use-this
    public provideCodeLenses(document: TextDocument, cancelToken: CancellationToken): CodeLens[] {
        const command: Command = {
            title: TensorBoard.launchNativeTensorBoardSessionCodeLens,
            command: Commands.LaunchTensorBoard,
            arguments: [
                { trigger: TensorBoardEntrypointTrigger.fileimport, entrypoint: TensorBoardEntrypoint.codelens },
            ],
        };
        const codelenses: CodeLens[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            if (cancelToken.isCancellationRequested) {
                return codelenses;
            }
            const line = document.lineAt(index);
            if (containsTensorBoardImport([line.text])) {
                const range = new Range(new Position(line.lineNumber, 0), new Position(line.lineNumber, 1));
                codelenses.push(new CodeLens(range, command));
                this.sendTelemetryOnce();
            }
        }
        return codelenses;
    }

    private async activateInternal() {
        this.disposables.push(languages.registerCodeLensProvider(PYTHON, this));
    }
}
