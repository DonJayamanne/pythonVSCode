// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { once } from 'lodash';
import { CancellationToken, CodeLens, Command, Disposable, languages, Position, Range, TextDocument } from 'vscode';
import { IExtensionSingleActivationService } from '../activation/types';
import { Commands, NotebookCellScheme, PYTHON_LANGUAGE } from '../common/constants';
import { IDisposable, IDisposableRegistry } from '../common/types';
import { TensorBoard } from '../common/utils/localize';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { TensorBoardEntrypoint, TensorBoardEntrypointTrigger } from './constants';
import { containsNotebookExtension } from './helpers';
import { TensorboardExperiment } from './tensorboarExperiment';

@injectable()
export class TensorBoardNbextensionCodeLensProvider implements IExtensionSingleActivationService {
    public readonly supportedWorkspaceTypes = { untrustedWorkspace: false, virtualWorkspace: false };

    private readonly disposables: IDisposable[] = [];

    private sendTelemetryOnce = once(
        sendTelemetryEvent.bind(this, EventName.TENSORBOARD_ENTRYPOINT_SHOWN, undefined, {
            trigger: TensorBoardEntrypointTrigger.nbextension,
            entrypoint: TensorBoardEntrypoint.codelens,
        }),
    );

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

    private async activateInternal() {
        this.disposables.push(
            languages.registerCodeLensProvider(
                [
                    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
                    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
                ],
                this,
            ),
        );
    }

    public provideCodeLenses(document: TextDocument, cancelToken: CancellationToken): CodeLens[] {
        const command: Command = {
            title: TensorBoard.launchNativeTensorBoardSessionCodeLens,
            command: Commands.LaunchTensorBoard,
            arguments: [
                { trigger: TensorBoardEntrypointTrigger.nbextension, entrypoint: TensorBoardEntrypoint.codelens },
            ],
        };
        const codelenses: CodeLens[] = [];
        for (let index = 0; index < document.lineCount; index += 1) {
            if (cancelToken.isCancellationRequested) {
                return codelenses;
            }
            const line = document.lineAt(index);
            if (containsNotebookExtension([line.text])) {
                const range = new Range(new Position(line.lineNumber, 0), new Position(line.lineNumber, 1));
                codelenses.push(new CodeLens(range, command));
                this.sendTelemetryOnce();
            }
        }
        return codelenses;
    }
}
