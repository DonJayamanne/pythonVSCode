// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import { inject, injectable } from 'inversify';
import * as uuid from 'uuid/v4';
import { DebugConfiguration } from 'vscode';

import { ICommandManager, IDebugService } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { Identifiers } from '../constants';
import { CellState, ICell, IDebuggerConnectInfo, IJupyterDebugger, INotebookServer } from '../types';

@injectable()
export class JupyterDebugger implements IJupyterDebugger {
    private connectInfo: IDebuggerConnectInfo | undefined;

    constructor(
            @inject(ICommandManager) private commandManager: ICommandManager,
            @inject(IDebugService) private debugService: IDebugService
        ) {}

    public async enableAttach(server: INotebookServer): Promise<void> {
                //await this.jupyterServer.execute(`import ptvsd\r\nptvsd.wait_for_attach()`, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
        //// tslint:disable-next-line:no-multiline-string
        //const enableDebuggerResults = await this.executeSilently(`import sys\r\nsys.path.append('d:/ptvsd-drop/kdrop/src')\r\nimport os\r\nos.environ["PTVSD_LOG_DIR"] = "d:/note_dbg/logs"\r\nimport ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);
        ////const enableDebuggerResults = await this.executeSilently(`import ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);

        //const enableAttachString = enableDebuggerResults.length > 0 ? this.extractStreamOutput(enableDebuggerResults[0]).trimQuotes() : '';
        //traceInfo(enableAttachString);

        //const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

        //const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
        //if (debugInfoMatch) {
            //return { hostName: debugInfoMatch[1], port: parseInt(debugInfoMatch[2], 10) };
        //}

        //return undefined;
        traceInfo('enable debugger attach');

        // IANHU this current import is only for local testing with specific bits. The main ptvsd code is below
        // tslint:disable-next-line:no-multiline-string
        const enableDebuggerResults = await this.executeSilently(server, `import sys\r\nsys.path.append('d:/ptvsd-drop/kdrop/src')\r\nimport os\r\nos.environ["PTVSD_LOG_DIR"] = "d:/note_dbg/logs"\r\nimport ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);
        //const enableDebuggerResults = await this.executeSilently(`import ptvsd\r\nptvsd.enable_attach(('localhost', 0))`);
        this.connectInfo = this.parseConnectInfo(enableDebuggerResults);
        // IANHU: We need to clear this out when disconnected from the server
    }

    public async startDebugging(server: INotebookServer): Promise<void> {
        traceInfo('start debugging');
        // IANHU: no connect info = throw exception? Log it?
        if (this.connectInfo) {
            // First connect the VSCode UI
            const config: DebugConfiguration = {
                name: 'IPython',
                request: 'attach',
                type: 'python',
                port: this.connectInfo.port,
                host: this.connectInfo.hostName
            };

            await this.debugService.startDebugging(undefined, config);

            // Wait for attach before we turn on tracing and allow the code to run, if the IDE is already attached this is just a no-op
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `import ptvsd\r\nptvsd.wait_for_attach()`);

            // Then enable tracing
            // tslint:disable-next-line:no-multiline-string
            await this.executeSilently(server, `from ptvsd import tracing\r\ntracing(True)`);
        }
    }

    public async stopDebugging(server: INotebookServer): Promise<void> {
        traceInfo('stop debugging');
        // Disable tracing
        // tslint:disable-next-line:no-multiline-string
        await this.executeSilently(server, `from ptvsd import tracing\r\ntracing(False)`);

        // Stop our debugging UI session, no await as we just want it stopped
        this.commandManager.executeCommand('workbench.action.debug.stop');
    }

    private executeSilently(server: INotebookServer, code: string): Promise<ICell[]> {
        // IANHU add to notebook server interface?
        return server.execute(code, Identifiers.EmptyFileName, 0, uuid(), undefined, true);
    }

    private parseConnectInfo(cells: ICell[]): IDebuggerConnectInfo | undefined {
        const enableAttachString = cells.length > 0 ? this.extractStreamOutput(cells[0]).trimQuotes() : '';

        const debugInfoRegEx = /\('(.*?)', ([0-9]*)\)/;

        const debugInfoMatch = debugInfoRegEx.exec(enableAttachString);
        if (debugInfoMatch) {
            return { hostName: debugInfoMatch[1], port: parseInt(debugInfoMatch[2], 10) };
        }

        return undefined;
    }

    // IANHU Copied from INotebookServer, combine?
    private extractStreamOutput(cell: ICell): string {
        let result = '';
        if (cell.state === CellState.error || cell.state === CellState.finished) {
            const outputs = cell.data.outputs as nbformat.IOutput[];
            if (outputs) {
                outputs.forEach(o => {
                    if (o.output_type === 'stream') {
                        const stream = o as nbformat.IStream;
                        result = result.concat(stream.text.toString());
                    } else {
                        const data = o.data;
                        if (data && data.hasOwnProperty('text/plain')) {
                            // tslint:disable-next-line:no-any
                            result = result.concat((data as any)['text/plain']);
                        }
                    }
                });
            }
        }
        return result;
    }
}
