// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import { Uri } from 'vscode';
import { IServerState } from '../../../datascience-ui/interactive-common/mainState';

import { KernelMessage } from '@jupyterlab/services';
import { CommonActionType, IAddCellAction } from '../../../datascience-ui/interactive-common/redux/reducers/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { LiveKernelModel } from '../jupyter/kernels/types';
import { CssMessages, IGetCssRequest, IGetCssResponse, IGetMonacoThemeRequest, SharedMessages } from '../messages';
import { IGetMonacoThemeResponse } from '../monacoMessages';
import {
    ICell,
    IInteractiveWindowInfo,
    IJupyterKernelSpec,
    IJupyterVariable,
    IJupyterVariablesRequest,
    IJupyterVariablesResponse
} from '../types';
import { BaseReduxActionPayload } from './types';

export enum InteractiveWindowMessages {
    StartCell = 'start_cell',
    FinishCell = 'finish_cell',
    UpdateCell = 'update_cell',
    GotoCodeCell = 'gotocell_code',
    CopyCodeCell = 'copycell_code',
    NotebookExecutionActivated = 'notebook_execution_activated',
    RestartKernel = 'restart_kernel',
    Export = 'export_to_ipynb',
    GetAllCells = 'get_all_cells',
    ReturnAllCells = 'return_all_cells',
    DeleteAllCells = 'delete_all_cells',
    Undo = 'undo',
    Redo = 'redo',
    ExpandAll = 'expand_all',
    CollapseAll = 'collapse_all',
    StartProgress = 'start_progress',
    StopProgress = 'stop_progress',
    Interrupt = 'interrupt',
    SubmitNewCell = 'submit_new_cell',
    SettingsUpdated = 'settings_updated',
    // Message sent to React component from extension asking it to save the notebook.
    DoSave = 'DoSave',
    SendInfo = 'send_info',
    Started = 'started',
    AddedSysInfo = 'added_sys_info',
    RemoteAddCode = 'remote_add_code',
    RemoteReexecuteCode = 'remote_reexecute_code',
    Activate = 'activate',
    ShowDataViewer = 'show_data_explorer',
    GetVariablesRequest = 'get_variables_request',
    GetVariablesResponse = 'get_variables_response',
    VariableExplorerToggle = 'variable_explorer_toggle',
    ProvideCompletionItemsRequest = 'provide_completion_items_request',
    CancelCompletionItemsRequest = 'cancel_completion_items_request',
    ProvideCompletionItemsResponse = 'provide_completion_items_response',
    ProvideHoverRequest = 'provide_hover_request',
    CancelHoverRequest = 'cancel_hover_request',
    ProvideHoverResponse = 'provide_hover_response',
    ProvideSignatureHelpRequest = 'provide_signature_help_request',
    CancelSignatureHelpRequest = 'cancel_signature_help_request',
    ProvideSignatureHelpResponse = 'provide_signature_help_response',
    ResolveCompletionItemRequest = 'resolve_completion_item_request',
    CancelResolveCompletionItemRequest = 'cancel_resolve_completion_item_request',
    ResolveCompletionItemResponse = 'resolve_completion_item_response',
    Sync = 'sync_message_used_to_broadcast_and_sync_editors',
    LoadOnigasmAssemblyRequest = 'load_onigasm_assembly_request',
    LoadOnigasmAssemblyResponse = 'load_onigasm_assembly_response',
    LoadTmLanguageRequest = 'load_tmlanguage_request',
    LoadTmLanguageResponse = 'load_tmlanguage_response',
    OpenLink = 'open_link',
    ShowPlot = 'show_plot',
    SavePng = 'save_png',
    StartDebugging = 'start_debugging',
    StopDebugging = 'stop_debugging',
    GatherCodeRequest = 'gather_code',
    LoadAllCells = 'load_all_cells',
    LoadAllCellsComplete = 'load_all_cells_complete',
    ScrollToCell = 'scroll_to_cell',
    ReExecuteCells = 'reexecute_cells',
    NotebookIdentity = 'identity',
    NotebookDirty = 'dirty',
    NotebookClean = 'clean',
    SaveAll = 'save_all',
    NativeCommand = 'native_command',
    VariablesComplete = 'variables_complete',
    NotebookRunAllCells = 'notebook_run_all_cells',
    NotebookRunSelectedCell = 'notebook_run_selected_cell',
    NotebookAddCellBelow = 'notebook_add_cell_below',
    ExecutionRendered = 'rendered_execution',
    FocusedCellEditor = 'focused_cell_editor',
    UnfocusedCellEditor = 'unfocused_cell_editor',
    MonacoReady = 'monaco_ready',
    ClearAllOutputs = 'clear_all_outputs',
    SelectKernel = 'select_kernel',
    UpdateKernel = 'update_kernel',
    SelectJupyterServer = 'select_jupyter_server',
    UpdateModel = 'update_model',
    ReceivedUpdateModel = 'received_update_model',
    OpenSettings = 'open_settings'
}

export enum IPyWidgetMessages {
    IPyWidgets_display_data_msg = 'IPyWidgets_display_data_msg',
    IPyWidgets_comm_msg = 'IPyWidgets_comm_msg',
    IPyWidgets_comm_open = 'IPyWidgets_comm_open',
    IPyWidgets_ShellSend = 'IPyWidgets_ShellSend',
    IPyWidgets_ShellCommOpen = 'IPyWidgets_ShellCommOpen',
    IPyWidgets_registerCommTarget = 'IPyWidgets_registerCommTarget',
    IPyWidgets_ShellSend_onIOPub = 'IPyWidgets_ShellSend_onIOPub',
    IPyWidgets_ShellSend_reply = 'IPyWidgets_ShellSend_reply',
    IPyWidgets_ShellSend_resolve = 'IPyWidgets_ShellSend_resolve',
    IPyWidgets_ShellSend_reject = 'IPyWidgets_ShellSend_reject'
}
export enum NativeCommandType {
    AddToEnd = 0,
    ArrowDown,
    ArrowUp,
    ChangeToCode,
    ChangeToMarkdown,
    CollapseInput,
    CollapseOutput,
    DeleteCell,
    Save,
    InsertAbove,
    InsertBelow,
    MoveCellDown,
    MoveCellUp,
    Redo,
    Run,
    RunAbove,
    RunAll,
    RunAndAdd,
    RunAndMove,
    RunBelow,
    SelectKernel,
    SelectServer,
    ToggleLineNumbers,
    ToggleOutput,
    ToggleVariableExplorer,
    Undo,
    Unfocus
}

// These are the messages that will mirror'd to guest/hosts in
// a live share session
export const InteractiveWindowRemoteMessages: string[] = [
    InteractiveWindowMessages.AddedSysInfo.toString(),
    InteractiveWindowMessages.RemoteAddCode.toString(),
    InteractiveWindowMessages.RemoteReexecuteCode.toString()
];

export interface IGotoCode {
    file: string;
    line: number;
}

export interface ICopyCode {
    source: string;
}

export enum SysInfoReason {
    Start,
    Restart,
    Interrupt,
    New,
    Connect
}

export interface IAddedSysInfo {
    type: SysInfoReason;
    id: string;
    sysInfoCell: ICell;
}

export interface IExecuteInfo {
    code: string;
    id: string;
    file: string;
    line: number;
    debug: boolean;
}

export interface IRemoteAddCode extends IExecuteInfo {
    originator: string;
}

export interface IRemoteReexecuteCode extends IExecuteInfo {
    originator: string;
}

export interface ISubmitNewCell {
    code: string;
    id: string;
}

export interface IReExecuteCells {
    cellIds: string[];
}

export interface IProvideCompletionItemsRequest {
    position: monacoEditor.Position;
    context: monacoEditor.languages.CompletionContext;
    requestId: string;
    cellId: string;
}

export interface IProvideHoverRequest {
    position: monacoEditor.Position;
    requestId: string;
    cellId: string;
}

export interface IProvideSignatureHelpRequest {
    position: monacoEditor.Position;
    context: monacoEditor.languages.SignatureHelpContext;
    requestId: string;
    cellId: string;
}

export interface ICancelIntellisenseRequest {
    requestId: string;
}

export interface IResolveCompletionItemRequest {
    position: monacoEditor.Position;
    item: monacoEditor.languages.CompletionItem;
    requestId: string;
    cellId: string;
}

export interface IProvideCompletionItemsResponse {
    list: monacoEditor.languages.CompletionList;
    requestId: string;
}

export interface IProvideHoverResponse {
    hover: monacoEditor.languages.Hover;
    requestId: string;
}

export interface IProvideSignatureHelpResponse {
    signatureHelp: monacoEditor.languages.SignatureHelp;
    requestId: string;
}

export interface IResolveCompletionItemResponse {
    item: monacoEditor.languages.CompletionItem;
    requestId: string;
}

export interface IPosition {
    line: number;
    ch: number;
}

export interface IEditCell {
    changes: monacoEditor.editor.IModelContentChange[];
    id: string;
}

export interface IAddCell {
    fullText: string;
    currentText: string;
    cell: ICell;
}

export interface IRemoveCell {
    id: string;
}

export interface ISwapCells {
    firstCellId: string;
    secondCellId: string;
}

export interface IInsertCell {
    cell: ICell;
    code: string;
    index: number;
    codeCellAboveId: string | undefined;
}

export interface IShowDataViewer {
    variable: IJupyterVariable;
    columnSize: number;
}

export interface IRefreshVariablesRequest {
    newExecutionCount?: number;
}

export interface ILoadAllCells {
    cells: ICell[];
}

export interface IScrollToCell {
    id: string;
}

export interface INotebookIdentity {
    resource: string;
}

export interface ISaveAll {
    cells: ICell[];
}

export interface INativeCommand {
    command: NativeCommandType;
    source: 'keyboard' | 'mouse';
}

export interface IRenderComplete {
    ids: string[];
}

export interface IFocusedCellEditor {
    cellId: string;
}

export interface INotebookModelChange {
    oldDirty: boolean;
    newDirty: boolean;
    source: 'undo' | 'user' | 'redo';
}

export interface INotebookModelRemoveAllChange extends INotebookModelChange {
    kind: 'remove_all';
    oldCells: ICell[];
    newCellId: string;
}
export interface INotebookModelModifyChange extends INotebookModelChange {
    kind: 'modify';
    newCells: ICell[];
    oldCells: ICell[];
}

export interface INotebookModelClearChange extends INotebookModelChange {
    kind: 'clear';
    oldCells: ICell[];
}

export interface INotebookModelSwapChange extends INotebookModelChange {
    kind: 'swap';
    firstCellId: string;
    secondCellId: string;
}

export interface INotebookModelRemoveChange extends INotebookModelChange {
    kind: 'remove';
    cell: ICell;
    index: number;
}

export interface INotebookModelInsertChange extends INotebookModelChange {
    kind: 'insert';
    cell: ICell;
    index: number;
    codeCellAboveId?: string;
}

export interface INotebookModelAddChange extends INotebookModelChange {
    kind: 'add';
    cell: ICell;
    fullText: string;
    currentText: string;
}

export interface INotebookModelChangeTypeChange extends INotebookModelChange {
    kind: 'changeCellType';
    cell: ICell;
}

export interface IEditorPosition {
    /**
     * line number (starts at 1)
     */
    readonly lineNumber: number;
    /**
     * column (the first character in a line is between column 1 and column 2)
     */
    readonly column: number;
}

export interface IEditorRange {
    /**
     * Line number on which the range starts (starts at 1).
     */
    readonly startLineNumber: number;
    /**
     * Column on which the range starts in line `startLineNumber` (starts at 1).
     */
    readonly startColumn: number;
    /**
     * Line number on which the range ends.
     */
    readonly endLineNumber: number;
    /**
     * Column on which the range ends in line `endLineNumber`.
     */
    readonly endColumn: number;
}

export interface IEditorContentChange {
    /**
     * The range that got replaced.
     */
    readonly range: IEditorRange;
    /**
     * The offset of the range that got replaced.
     */
    readonly rangeOffset: number;
    /**
     * The length of the range that got replaced.
     */
    readonly rangeLength: number;
    /**
     * The new text for the range.
     */
    readonly text: string;
    /**
     * The cursor position to be set after the change
     */
    readonly position: IEditorPosition;
}

export interface INotebookModelEditChange extends INotebookModelChange {
    kind: 'edit';
    forward: IEditorContentChange[];
    reverse: IEditorContentChange[];
    id: string;
}

export interface INotebookModelVersionChange extends INotebookModelChange {
    kind: 'version';
    interpreter: PythonInterpreter | undefined;
    kernelSpec: IJupyterKernelSpec | LiveKernelModel | undefined;
}

export interface INotebookModelFileChange extends INotebookModelChange {
    kind: 'file';
    newFile: Uri;
    oldFile: Uri;
}

export type NotebookModelChange =
    | INotebookModelModifyChange
    | INotebookModelRemoveAllChange
    | INotebookModelClearChange
    | INotebookModelSwapChange
    | INotebookModelRemoveChange
    | INotebookModelInsertChange
    | INotebookModelAddChange
    | INotebookModelEditChange
    | INotebookModelVersionChange
    | INotebookModelFileChange
    | INotebookModelChangeTypeChange;

// Map all messages to specific payloads
export class IInteractiveWindowMapping {
    // tslint:disable-next-line: no-any
    public [IPyWidgetMessages.IPyWidgets_ShellSend]: {
        // tslint:disable-next-line: no-any
        data: any;
        // tslint:disable-next-line: no-any
        metadata: any;
        commId: string;
        requestId: string;
        // tslint:disable-next-line: no-any
        buffers?: any[];
        disposeOnDone?: boolean;
        targetName?: string;
        msgType: string;
    };
    // tslint:disable-next-line: no-any
    public [IPyWidgetMessages.IPyWidgets_ShellSend_onIOPub]: { requestId: string; msg: KernelMessage.IIOPubMessage };
    public [IPyWidgetMessages.IPyWidgets_ShellSend_reply]: { requestId: string; msg: KernelMessage.IShellMessage };
    public [IPyWidgetMessages.IPyWidgets_ShellSend_resolve]: { requestId: string; msg?: KernelMessage.IShellMessage };
    // tslint:disable-next-line: no-any
    public [IPyWidgetMessages.IPyWidgets_ShellSend_reject]: { requestId: string; msg?: any };
    public [IPyWidgetMessages.IPyWidgets_registerCommTarget]: string;
    public [IPyWidgetMessages.IPyWidgets_comm_open]: KernelMessage.ICommOpenMsg;
    public [IPyWidgetMessages.IPyWidgets_comm_msg]: KernelMessage.ICommMsgMsg;
    public [IPyWidgetMessages.IPyWidgets_display_data_msg]: KernelMessage.IDisplayDataMsg;

    public [InteractiveWindowMessages.StartCell]: ICell;
    public [InteractiveWindowMessages.FinishCell]: ICell;
    public [InteractiveWindowMessages.UpdateCell]: ICell;
    public [InteractiveWindowMessages.GotoCodeCell]: IGotoCode;
    public [InteractiveWindowMessages.CopyCodeCell]: ICopyCode;
    public [InteractiveWindowMessages.NotebookExecutionActivated]: string;
    public [InteractiveWindowMessages.RestartKernel]: never | undefined;
    public [InteractiveWindowMessages.SelectKernel]: IServerState | undefined;
    public [InteractiveWindowMessages.SelectJupyterServer]: never | undefined;
    public [InteractiveWindowMessages.OpenSettings]: string | undefined;
    public [InteractiveWindowMessages.Export]: ICell[];
    public [InteractiveWindowMessages.GetAllCells]: never | undefined;
    public [InteractiveWindowMessages.ReturnAllCells]: ICell[];
    public [InteractiveWindowMessages.DeleteAllCells]: IAddCellAction;
    public [InteractiveWindowMessages.Undo]: never | undefined;
    public [InteractiveWindowMessages.Redo]: never | undefined;
    public [InteractiveWindowMessages.ExpandAll]: never | undefined;
    public [InteractiveWindowMessages.CollapseAll]: never | undefined;
    public [InteractiveWindowMessages.StartProgress]: never | undefined;
    public [InteractiveWindowMessages.StopProgress]: never | undefined;
    public [InteractiveWindowMessages.Interrupt]: never | undefined;
    public [InteractiveWindowMessages.SettingsUpdated]: string;
    public [InteractiveWindowMessages.SubmitNewCell]: ISubmitNewCell;
    public [InteractiveWindowMessages.SendInfo]: IInteractiveWindowInfo;
    public [InteractiveWindowMessages.Started]: never | undefined;
    public [InteractiveWindowMessages.AddedSysInfo]: IAddedSysInfo;
    public [InteractiveWindowMessages.RemoteAddCode]: IRemoteAddCode;
    public [InteractiveWindowMessages.RemoteReexecuteCode]: IRemoteReexecuteCode;
    public [InteractiveWindowMessages.Activate]: never | undefined;
    public [InteractiveWindowMessages.ShowDataViewer]: IShowDataViewer;
    public [InteractiveWindowMessages.GetVariablesRequest]: IJupyterVariablesRequest;
    public [InteractiveWindowMessages.GetVariablesResponse]: IJupyterVariablesResponse;
    public [InteractiveWindowMessages.VariableExplorerToggle]: boolean;
    public [CssMessages.GetCssRequest]: IGetCssRequest;
    public [CssMessages.GetCssResponse]: IGetCssResponse;
    public [CssMessages.GetMonacoThemeRequest]: IGetMonacoThemeRequest;
    public [CssMessages.GetMonacoThemeResponse]: IGetMonacoThemeResponse;
    public [InteractiveWindowMessages.ProvideCompletionItemsRequest]: IProvideCompletionItemsRequest;
    public [InteractiveWindowMessages.CancelCompletionItemsRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideCompletionItemsResponse]: IProvideCompletionItemsResponse;
    public [InteractiveWindowMessages.ProvideHoverRequest]: IProvideHoverRequest;
    public [InteractiveWindowMessages.CancelHoverRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideHoverResponse]: IProvideHoverResponse;
    public [InteractiveWindowMessages.ProvideSignatureHelpRequest]: IProvideSignatureHelpRequest;
    public [InteractiveWindowMessages.CancelSignatureHelpRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ProvideSignatureHelpResponse]: IProvideSignatureHelpResponse;
    public [InteractiveWindowMessages.ResolveCompletionItemRequest]: IResolveCompletionItemRequest;
    public [InteractiveWindowMessages.CancelResolveCompletionItemRequest]: ICancelIntellisenseRequest;
    public [InteractiveWindowMessages.ResolveCompletionItemResponse]: IResolveCompletionItemResponse;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyRequest]: never | undefined;
    public [InteractiveWindowMessages.LoadOnigasmAssemblyResponse]: Buffer;
    public [InteractiveWindowMessages.LoadTmLanguageRequest]: never | undefined;
    public [InteractiveWindowMessages.LoadTmLanguageResponse]: string | undefined;
    public [InteractiveWindowMessages.OpenLink]: string | undefined;
    public [InteractiveWindowMessages.ShowPlot]: string | undefined;
    public [InteractiveWindowMessages.SavePng]: string | undefined;
    public [InteractiveWindowMessages.StartDebugging]: never | undefined;
    public [InteractiveWindowMessages.StopDebugging]: never | undefined;
    public [InteractiveWindowMessages.GatherCodeRequest]: ICell;
    public [InteractiveWindowMessages.LoadAllCells]: ILoadAllCells;
    public [InteractiveWindowMessages.LoadAllCellsComplete]: ILoadAllCells;
    public [InteractiveWindowMessages.ScrollToCell]: IScrollToCell;
    public [InteractiveWindowMessages.ReExecuteCells]: IReExecuteCells;
    public [InteractiveWindowMessages.NotebookIdentity]: INotebookIdentity;
    public [InteractiveWindowMessages.NotebookDirty]: never | undefined;
    public [InteractiveWindowMessages.NotebookClean]: never | undefined;
    public [InteractiveWindowMessages.SaveAll]: ISaveAll;
    public [InteractiveWindowMessages.Sync]: {
        type: InteractiveWindowMessages | SharedMessages | CommonActionType;
        // tslint:disable-next-line: no-any
        payload: BaseReduxActionPayload<any>;
    };
    public [InteractiveWindowMessages.NativeCommand]: INativeCommand;
    public [InteractiveWindowMessages.VariablesComplete]: never | undefined;
    public [InteractiveWindowMessages.NotebookRunAllCells]: never | undefined;
    public [InteractiveWindowMessages.NotebookRunSelectedCell]: never | undefined;
    public [InteractiveWindowMessages.NotebookAddCellBelow]: IAddCellAction;
    public [InteractiveWindowMessages.DoSave]: never | undefined;
    public [InteractiveWindowMessages.ExecutionRendered]: IRenderComplete;
    public [InteractiveWindowMessages.FocusedCellEditor]: IFocusedCellEditor;
    public [InteractiveWindowMessages.UnfocusedCellEditor]: never | undefined;
    public [InteractiveWindowMessages.MonacoReady]: never | undefined;
    public [InteractiveWindowMessages.ClearAllOutputs]: never | undefined;
    public [InteractiveWindowMessages.UpdateKernel]: IServerState | undefined;
    public [InteractiveWindowMessages.UpdateModel]: NotebookModelChange;
    public [InteractiveWindowMessages.ReceivedUpdateModel]: never | undefined;
    public [SharedMessages.UpdateSettings]: string;
    public [SharedMessages.LocInit]: string;
}
