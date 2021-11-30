// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { CancellationToken, Position, TextDocument, Uri } from 'vscode';
import { Channel, Commands, CommandSource } from '../constants';

export type CommandsWithoutArgs = keyof ICommandNameWithoutArgumentTypeMapping;

/**
 * Mapping between commands and list or arguments.
 * These commands do NOT have any arguments.
 * @interface ICommandNameWithoutArgumentTypeMapping
 */
interface ICommandNameWithoutArgumentTypeMapping {
    ['workbench.action.showCommands']: [];
    ['workbench.action.debug.continue']: [];
    ['workbench.action.debug.stepOver']: [];
    ['workbench.action.debug.stop']: [];
    ['workbench.action.reloadWindow']: [];
    ['workbench.action.closeActiveEditor']: [];
    ['editor.action.formatDocument']: [];
    ['editor.action.rename']: [];
    [Commands.ViewOutput]: [];
    [Commands.Start_REPL]: [];
    [Commands.Create_Terminal]: [];
    [Commands.ClearStorage]: [];
}

export type AllCommands = keyof ICommandNameArgumentTypeMapping;

/**
 * Mapping between commands and list of arguments.
 * Used to provide strong typing for command & args.
 * @export
 * @interface ICommandNameArgumentTypeMapping
 * @extends {ICommandNameWithoutArgumentTypeMapping}
 */
export interface ICommandNameArgumentTypeMapping extends ICommandNameWithoutArgumentTypeMapping {
    ['vscode.openWith']: [Uri, string];
    ['workbench.action.quickOpen']: [string];
    ['workbench.extensions.installExtension']: [
        Uri | 'ms-python.python',
        (
            | {
                  installOnlyNewlyAddedFromExtensionPackVSIX?: boolean;
                  installPreReleaseVersion?: boolean;
                  donotSync?: boolean;
              }
            | undefined
        ),
    ];
    ['workbench.action.files.openFolder']: [];
    ['workbench.action.openWorkspace']: [];
    ['setContext']: [string, boolean] | ['python.vscode.channel', Channel];
    ['python.reloadVSCode']: [string];
    ['revealLine']: [{ lineNumber: number; at: 'top' | 'center' | 'bottom' }];
    ['python._loadLanguageServerExtension']: [];
    ['python.SelectAndInsertDebugConfiguration']: [TextDocument, Position, CancellationToken];
    ['vscode.open']: [Uri];
    ['notebook.execute']: [];
    ['notebook.cell.execute']: [];
    ['notebook.cell.insertCodeCellBelow']: [];
    ['notebook.undo']: [];
    ['notebook.redo']: [];
    ['python.viewLanguageServerOutput']: [];
    ['vscode.open']: [Uri];
    ['workbench.action.files.saveAs']: [Uri];
    ['workbench.action.files.save']: [Uri];
    ['jupyter.opennotebook']: [undefined | Uri, undefined | CommandSource];
    ['jupyter.runallcells']: [Uri];
    ['extension.open']: [string];
    ['workbench.action.openIssueReporter']: [{ extensionId: string; issueBody: string }];
    [Commands.Exec_In_Terminal]: [undefined, Uri];
    [Commands.Exec_In_Terminal_Icon]: [undefined, Uri];
    ['workbench.view.testing.focus']: [];
}
