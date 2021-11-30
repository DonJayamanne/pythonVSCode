// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Disposable, Event, EventEmitter, Uri } from 'vscode';

import { ICommandManager } from '../../common/application/types';
import { Commands } from '../../common/constants';
import '../../common/extensions';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry, Resource } from '../../common/types';
import { noop } from '../../common/utils/misc';
import { IServiceContainer } from '../../ioc/types';
import { traceError } from '../../logging';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService } from '../../terminals/types';

@injectable()
export class CodeExecutionManager implements ICodeExecutionManager {
    private eventEmitter: EventEmitter<string> = new EventEmitter<string>();
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(IDisposableRegistry) private disposableRegistry: Disposable[],
        @inject(IFileSystem) private fileSystem: IFileSystem,
        @inject(IServiceContainer) private serviceContainer: IServiceContainer,
    ) {}

    public get onExecutedCode(): Event<string> {
        return this.eventEmitter.event;
    }

    public registerCommands() {
        [Commands.Exec_In_Terminal, Commands.Exec_In_Terminal_Icon].forEach((cmd) => {
            this.disposableRegistry.push(
                this.commandManager.registerCommand(cmd as any, async (file: Resource) => {
                    const trigger = cmd === Commands.Exec_In_Terminal ? 'command' : 'icon';
                    await this.executeFileInTerminal(file, trigger).catch((ex) =>
                        traceError('Failed to execute file in terminal', ex),
                    );
                }),
            );
        });
    }
    private async executeFileInTerminal(file: Resource, trigger: 'command' | 'icon') {
        sendTelemetryEvent(EventName.EXECUTION_CODE, undefined, { scope: 'file', trigger });
        const codeExecutionHelper = this.serviceContainer.get<ICodeExecutionHelper>(ICodeExecutionHelper);
        file = file instanceof Uri ? file : undefined;
        const fileToExecute = file ? file : await codeExecutionHelper.getFileToExecute();
        if (!fileToExecute) {
            return;
        }
        await codeExecutionHelper.saveFileIfDirty(fileToExecute);

        try {
            const contents = await this.fileSystem.readFile(fileToExecute.fsPath);
            this.eventEmitter.fire(contents);
        } catch {
            // Ignore any errors that occur for firing this event. It's only used
            // for telemetry
            noop();
        }

        const executionService = this.serviceContainer.get<ICodeExecutionService>(ICodeExecutionService, 'standard');
        await executionService.executeFile(fileToExecute);
    }
}
