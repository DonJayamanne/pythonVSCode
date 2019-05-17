// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { min } from 'lodash';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import * as uuid from 'uuid/v4';

import { createDeferred, Deferred } from '../../client/common/utils/async';
import { noop } from '../../client/common/utils/misc';
import { CellMatcher } from '../../client/datascience/cellMatcher';
import { generateMarkdownFromCodeLines } from '../../client/datascience/common';
import { Identifiers } from '../../client/datascience/constants';
import { HistoryMessages, IHistoryMapping } from '../../client/datascience/history/historyTypes';
import { CellState, ICell, IHistoryInfo, IJupyterVariable, IJupyterVariablesResponse } from '../../client/datascience/types';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { IMessageHandler, PostOffice } from '../react-common/postOffice';
import { getSettings, updateSettings } from '../react-common/settingsReactSide';
import { StyleInjector } from '../react-common/styleInjector';
import { Cell, ICellViewModel } from './cell';
import { ContentPanel, IContentPanelProps } from './contentPanel';
import { HeaderPanel, IHeaderPanelProps } from './headerPanel';
import { InputHistory } from './inputHistory';
import { IntellisenseProvider } from './intellisenseProvider';
import { createCellVM, createEditableCellVM, extractInputText, generateTestState, IMainPanelState } from './mainPanelState';
import { initializeTokenizer, registerMonacoLanguage } from './tokenizer';
import { VariableExplorer } from './variableExplorer';

import './mainPanel.css';

export interface IMainPanelProps {
    skipDefault?: boolean;
    testMode?: boolean;
    baseTheme: string;
    codeTheme: string;
}

export class MainPanel extends React.Component<IMainPanelProps, IMainPanelState> implements IMessageHandler {
    private stackLimit = 10;
    private updateCount = 0;
    private renderCount = 0;
    private editCellRef: Cell | null = null;
    private mainPanel: HTMLDivElement | null = null;
    private variableExplorerRef: React.RefObject<VariableExplorer>;
    private styleInjectorRef: React.RefObject<StyleInjector>;
    private currentExecutionCount: number = 0;
    private postOffice: PostOffice = new PostOffice();
    private intellisenseProvider: IntellisenseProvider;
    private onigasmPromise: Deferred<ArrayBuffer> | undefined;
    private tmlangugePromise: Deferred<string> | undefined;
    private monacoIdToCellId: Map<string, string> = new Map<string, string>();

    // tslint:disable-next-line:max-func-body-length
    constructor(props: IMainPanelProps, _state: IMainPanelState) {
        super(props);

        // Default state should show a busy message
        this.state = {
            cellVMs: [],
            busy: true,
            undoStack: [],
            redoStack : [],
            submittedText: false,
            history: new InputHistory(),
            contentTop: 24,
            editCellVM: getSettings && getSettings().allowInput ? createEditableCellVM(1) : undefined
        };

        // Add test state if necessary
        if (!this.props.skipDefault) {
            this.state = generateTestState(this.inputBlockToggled);
        }

        // Create the ref to hold our variable explorer
        this.variableExplorerRef = React.createRef<VariableExplorer>();

        // Create the ref to hold our style injector
        this.styleInjectorRef = React.createRef<StyleInjector>();

        // Setup the completion provider for monaco. We only need one
        this.intellisenseProvider = new IntellisenseProvider(this.postOffice, this.getCellId);

        // Setup the tokenizer for monaco if running inside of vscode
        if (this.props.skipDefault) {
            if (this.props.testMode) {
                // Running a test, skip the tokenizer. We want the UI to display synchronously
                this.state = {tokenizerLoaded: true, ...this.state};

                // However we still need to register python as a language
                registerMonacoLanguage();
            } else {
                initializeTokenizer(this.loadOnigasm, this.loadTmlanguage, this.tokenizerLoaded).ignoreErrors();
            }
        }
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.postOffice.addHandler(this);

        // Tell the history code we have started.
        this.postOffice.sendMessage<IHistoryMapping, 'started'>(HistoryMessages.Started);
    }

    public componentDidUpdate(_prevProps: Readonly<IMainPanelProps>, _prevState: Readonly<IMainPanelState>, _snapshot?: {}) {
        // If in test mode, update our outputs
        if (this.props.testMode) {
            this.updateCount = this.updateCount + 1;
        }
    }

    public componentWillUnmount() {
        // Remove ourselves as a handler for the post office
        this.postOffice.removeHandler(this);

        // Get rid of our completion provider
        this.intellisenseProvider.dispose();

        // Get rid of our post office
        this.postOffice.dispose();
    }

    public render() {

        // If in test mode, update our outputs
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        const baseTheme = this.computeBaseTheme();

        return (
            <div id='main-panel' ref={this.updateSelf}>
                <StyleInjector
                    expectingDark={baseTheme !== 'vscode-light'}
                    postOffice={this.postOffice}
                    darkChanged={this.darkChanged}
                    monacoThemeChanged={this.monacoThemeChanged}
                    ref={this.styleInjectorRef} />
                <div className='main-panel-header'>
                    <div className='main-panel-inner'>
                        {this.renderHeaderPanel(baseTheme)}
                    </div>
                </div>
                <div className='main-panel-content'>
                    <div className='main-panel-inner'>
                        <div className='main-panel-scrollable'>
                            {this.renderContentPanel(baseTheme)}
                        </div>
                    </div>
                </div>
                <div className='main-panel-footer'>
                    <div className='main-panel-inner'>
                        {this.renderFooterPanel(baseTheme)}
                    </div>
                </div>
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) => {
        switch (msg) {
            case HistoryMessages.StartCell:
                this.startCell(payload);
                return true;

            case HistoryMessages.FinishCell:
                this.finishCell(payload);
                return true;

            case HistoryMessages.UpdateCell:
                this.updateCell(payload);
                return true;

            case HistoryMessages.GetAllCells:
                this.getAllCells();
                return true;

            case HistoryMessages.ExpandAll:
                this.expandAllSilent();
                return true;

            case HistoryMessages.CollapseAll:
                this.collapseAllSilent();
                return true;

            case HistoryMessages.DeleteAllCells:
                this.clearAllSilent();
                return true;

            case HistoryMessages.Redo:
                this.redo();
                return true;

            case HistoryMessages.Undo:
                this.undo();
                return true;

            case HistoryMessages.StartProgress:
                if (!this.props.testMode) {
                    this.setState({busy: true});
                }
                break;

            case HistoryMessages.StopProgress:
                if (!this.props.testMode) {
                    this.setState({busy: false});
                }
                break;

            case HistoryMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            case HistoryMessages.Activate:
                this.activate();
                break;

            case HistoryMessages.GetVariablesResponse:
                this.getVariablesResponse(payload);
                break;

            case HistoryMessages.GetVariableValueResponse:
                this.getVariableValueResponse(payload);
                break;

            case HistoryMessages.LoadOnigasmAssemblyResponse:
                this.handleOnigasmResponse(payload);
                break;

            case HistoryMessages.LoadTmLanguageResponse:
                this.handleTmLanguageResponse(payload);
                break;

            default:
                break;
        }

        return false;
    }

    // Uncomment this to use for debugging messages. Add a call to this to stick in dummy sys info messages.
    // private addDebugMessageCell(message: string) {
    //     const cell: ICell = {
    //         id: '0',
    //         file: '',
    //         line: 0,
    //         state: CellState.finished,
    //         data: {
    //             cell_type: 'sys_info',
    //             version: '0.0.0.0',
    //             notebook_version: '0',
    //             path: '',
    //             message: message,
    //             connection: '',
    //             source: '',
    //             metadata: {}
    //         }
    //     };
    //     this.addCell(cell);
    // }

    private renderHeaderPanel(baseTheme: string) {
        const headerProps = this.getHeaderProps(baseTheme);
        return <HeaderPanel {...headerProps} />;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} />;
    }

    private renderFooterPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded || !this.state.editCellVM) {
            return null;
        }

        const maxOutputSize = getSettings().maxOutputSize;
        const errorBackgroundColor = getSettings().errorBackgroundColor;
        const actualErrorBackgroundColor = errorBackgroundColor ? errorBackgroundColor : '#FFFFFF';
        const maxTextSize = maxOutputSize && maxOutputSize < 10000 && maxOutputSize > 0 ? maxOutputSize : undefined;

        return (
            <div className='edit-panel'>
                <ErrorBoundary>
                    <Cell
                        history={this.state.history}
                        maxTextSize={maxTextSize}
                        autoFocus={document.hasFocus()}
                        testMode={this.props.testMode}
                        cellVM={this.state.editCellVM}
                        submitNewCode={this.submitInput}
                        baseTheme={baseTheme}
                        codeTheme={this.props.codeTheme}
                        showWatermark={!this.state.submittedText}
                        errorBackgroundColor={actualErrorBackgroundColor}
                        ref={this.saveEditCellRef}
                        gotoCode={noop}
                        delete={noop}
                        onCodeCreated={this.editableCodeCreated}
                        onCodeChange={this.codeChange}
                        monacoTheme={this.state.monacoTheme}
                    />
                </ErrorBoundary>
            </div>
        );
    }

    // Called by the header control when size changes (such as expanding variables)
    private onHeaderHeightChange = (newHeight: number) => {
        this.setState({contentTop: newHeight});
    }

    private darkChanged = (newDark: boolean) => {
        // update our base theme if allowed. Don't do this
        // during testing as it will mess up the expected render count.
        if (!this.props.testMode) {
            this.setState(
                {
                    forceDark: newDark
                }
            );
        }
    }

    private monacoThemeChanged = (theme: string) => {
        // update our base theme if allowed. Don't do this
        // during testing as it will mess up the expected render count.
        if (!this.props.testMode) {
            this.setState(
                {
                    monacoTheme: theme
                }
            );
        }
    }

    private computeBaseTheme(): string {
        // If we're ignoring, always light
        if (getSettings && getSettings().ignoreVscodeTheme) {
            return 'vscode-light';
        }

        // Otherwise see if the style injector has figured out
        // the theme is dark or not
        if (this.state.forceDark !== undefined) {
            return this.state.forceDark ? 'vscode-dark' : 'vscode-light';
        }

        return this.props.baseTheme;
    }

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            contentTop: this.state.contentTop,
            cellVMs: this.state.cellVMs,
            history: this.state.history,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.state.submittedText,
            gotoCellCode: this.gotoCellCode,
            deleteCell: this.deleteCell,
            skipNextScroll: this.state.skipNextScroll ? true : false,
            monacoTheme: this.state.monacoTheme,
            onCodeCreated: this.readOnlyCodeCreated,
            onCodeChange: this.codeChange
        };
    }
    private getHeaderProps = (baseTheme: string): IHeaderPanelProps => {
       return {
        addMarkdown: this.addMarkdown,
        busy: this.state.busy,
        collapseAll: this.collapseAll,
        expandAll: this.expandAll,
        export: this.export,
        restartKernel: this.restartKernel,
        interruptKernel: this.interruptKernel,
        undo: this.undo,
        redo: this.redo,
        clearAll: this.clearAll,
        skipDefault: this.props.skipDefault,
        showDataExplorer: this.showDataViewer,
        testMode: this.props.testMode,
        variableExplorerRef: this.variableExplorerRef,
        canCollapseAll: this.canCollapseAll(),
        canExpandAll: this.canExpandAll(),
        canExport: this.canExport(),
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        refreshVariables: this.refreshVariables,
        variableExplorerToggled: this.variableExplorerToggled,
        onHeightChange: this.onHeaderHeightChange,
        baseTheme: baseTheme
       };
    }

    private activate() {
        // Make sure the input cell gets focus
        if (getSettings && getSettings().allowInput) {
            // Delay this so that we make sure the outer frame has focus first.
            setTimeout(() => {
                // First we have to give ourselves focus (so that focus actually ends up in the code cell)
                if (this.mainPanel) {
                    this.mainPanel.focus({preventScroll: true});
                }

                if (this.editCellRef) {
                    this.editCellRef.giveFocus();
                }
            }, 100);
        }
    }

    // tslint:disable-next-line:no-any
    private updateSettings = (payload?: any) => {
        if (payload) {
            const prevShowInputs = getSettings().showCellInputCode;
            updateSettings(payload as string);

            // If our settings change updated show inputs we need to fix up our cells
            const showInputs = getSettings().showCellInputCode;

            if (prevShowInputs !== showInputs) {
                this.toggleCellInputVisibility(showInputs, getSettings().collapseCellInputCodeByDefault);
            }
        }
    }

    private showDataViewer = (targetVariable: string) => {
        this.sendMessage(HistoryMessages.ShowDataViewer, targetVariable);
    }

    private sendMessage<M extends IHistoryMapping, T extends keyof M>(type: T, payload?: M[T]) {
        this.postOffice.sendMessage<M, T>(type, payload);
    }

    private getAllCells = () => {
        // Send all of our cells back to the other side
        const cells = this.state.cellVMs.map((cellVM : ICellViewModel) => {
            return cellVM.cell;
        });

        this.sendMessage(HistoryMessages.ReturnAllCells, cells);
    }

    private saveEditCellRef = (ref: Cell | null) => {
        this.editCellRef = ref;
    }

    private addMarkdown = () => {
        this.addCell({
            data :         {
                cell_type: 'markdown',
                metadata: {},
                source: [
                    '## Cell 3\n',
                    'Here\'s some markdown\n',
                    '- A List\n',
                    '- Of Items'
                ]
            },
            id : '1111',
            file : 'foo.py',
            line : 0,
            state : CellState.finished
        });
    }

    private getNonEditCellVMs() : ICellViewModel [] {
        return this.state.cellVMs.filter(c => !c.editable);
    }

    private canCollapseAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canExpandAll = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canExport = () => {
        return this.getNonEditCellVMs().length > 0;
    }

    private canRedo = () => {
        return this.state.redoStack.length > 0 ;
    }

    private canUndo = () => {
        return this.state.undoStack.length > 0 ;
    }

    private pushStack = (stack : ICellViewModel[][], cells : ICellViewModel[]) => {
        // Get the undo stack up to the maximum length
        const slicedUndo = stack.slice(0, min([stack.length, this.stackLimit]));

        // Combine this with our set of cells
        return [...slicedUndo, cells];
    }

    private gotoCellCode = (index: number) => {
        // Find our cell
        const cellVM = this.state.cellVMs[index];

        // Send a message to the other side to jump to a particular cell
        this.sendMessage(HistoryMessages.GotoCodeCell, { file : cellVM.cell.file, line: cellVM.cell.line });
    }

    private deleteCell = (index: number) => {
        this.sendMessage(HistoryMessages.DeleteCell);
        const cellVM = this.state.cellVMs[index];
        if (cellVM) {
            this.sendMessage(HistoryMessages.RemoveCell, {id: cellVM.cell.id});
        }

        // Update our state
        this.setState({
            cellVMs: this.state.cellVMs.filter((_c : ICellViewModel, i: number) => {
                return i !== index;
            }),
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true
        });
    }

    private collapseAll = () => {
        this.sendMessage(HistoryMessages.CollapseAll);
        this.collapseAllSilent();
    }

    private expandAll = () => {
        this.sendMessage(HistoryMessages.ExpandAll);
        this.expandAllSilent();
    }

    private clearAll = () => {
        this.sendMessage(HistoryMessages.DeleteAllCells);
        this.clearAllSilent();
    }

    private clearAllSilent = () => {
        // Update our state
        this.setState({
            cellVMs: [],
            undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
            skipNextScroll: true,
            busy: false // No more progress on delete all
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private redo = () => {
        // Pop one off of our redo stack and update our undo
        const cells = this.state.redoStack[this.state.redoStack.length - 1];
        const redoStack = this.state.redoStack.slice(0, this.state.redoStack.length - 1);
        const undoStack = this.pushStack(this.state.undoStack, this.state.cellVMs);
        this.sendMessage(HistoryMessages.Redo);
        this.setState({
            cellVMs: cells,
            undoStack: undoStack,
            redoStack: redoStack,
            skipNextScroll: true
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private undo = () => {
        // Pop one off of our undo stack and update our redo
        const cells = this.state.undoStack[this.state.undoStack.length - 1];
        const undoStack = this.state.undoStack.slice(0, this.state.undoStack.length - 1);
        const redoStack = this.pushStack(this.state.redoStack, this.state.cellVMs);
        this.sendMessage(HistoryMessages.Undo);
        this.setState({
            cellVMs: cells,
            undoStack : undoStack,
            redoStack : redoStack,
            skipNextScroll : true
        });

        // Tell other side, we changed our number of cells
        this.sendInfo();
    }

    private restartKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(HistoryMessages.RestartKernel);
    }

    private interruptKernel = () => {
        // Send a message to the other side to restart the kernel
        this.sendMessage(HistoryMessages.Interrupt);
    }

    private export = () => {
        // Send a message to the other side to export our current list
        const cellContents: ICell[] = this.state.cellVMs.map((cellVM: ICellViewModel, _index: number) => { return cellVM.cell; });
        this.sendMessage(HistoryMessages.Export, cellContents);
    }

    private updateSelf = (r: HTMLDivElement) => {
        this.mainPanel = r;
    }

    // tslint:disable-next-line:no-any
    private addCell = (payload?: any) => {
        // Get our settings for if we should display input code and if we should collapse by default
        const showInputs = getSettings().showCellInputCode;
        const collapseInputs = getSettings().collapseCellInputCodeByDefault;

        if (payload) {
            const cell = payload as ICell;
            let cellVM: ICellViewModel = createCellVM(cell, getSettings(), this.inputBlockToggled);

            // Set initial cell visibility and collapse
            cellVM = this.alterCellVM(cellVM, showInputs, !collapseInputs);

            if (cellVM) {
                const newList = [...this.state.cellVMs, cellVM];
                this.setState({
                    cellVMs: newList,
                    undoStack: this.pushStack(this.state.undoStack, this.state.cellVMs),
                    redoStack: this.state.redoStack,
                    skipNextScroll: false
                });

                // Tell other side, we changed our number of cells
                this.sendInfo();
            }
        }
    }

    private getEditCell() : ICellViewModel | undefined {
        return this.state.editCellVM;
    }

    private inputBlockToggled = (id: string) => {
        // Create a shallow copy of the array, let not const as this is the shallow array copy that we will be changing
        const cellVMArray: ICellViewModel[] = [...this.state.cellVMs];
        const cellVMIndex = cellVMArray.findIndex((value: ICellViewModel) => {
            return value.cell.id === id;
        });

        if (cellVMIndex >= 0) {
            // Const here as this is the state object pulled off of our shallow array copy, we don't want to mutate it
            const targetCellVM = cellVMArray[cellVMIndex];

            // Mutate the shallow array copy
            cellVMArray[cellVMIndex] = this.alterCellVM(targetCellVM, true, !targetCellVM.inputBlockOpen);

            this.setState({
                skipNextScroll: true,
                cellVMs: cellVMArray
            });
        }
    }

    private toggleCellInputVisibility = (visible: boolean, collapse: boolean) => {
        this.alterAllCellVMs(visible, !collapse);
    }

    private collapseAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, false);
        }
    }

    private expandAllSilent = () => {
        if (getSettings().showCellInputCode) {
            this.alterAllCellVMs(true, true);
        }
    }

    private alterAllCellVMs = (visible: boolean, expanded: boolean) => {
        const newCells = this.state.cellVMs.map((value: ICellViewModel) => {
            return this.alterCellVM(value, visible, expanded);
        });

        this.setState({
            skipNextScroll: true,
            cellVMs: newCells
        });
    }

    // Adjust the visibility or collapsed state of a cell
    private alterCellVM = (cellVM: ICellViewModel, visible: boolean, expanded: boolean) => {
        if (cellVM.cell.data.cell_type === 'code') {
            // If we are already in the correct state, return back our initial cell vm
            if (cellVM.inputBlockShow === visible && cellVM.inputBlockOpen === expanded) {
                return cellVM;
            }

            const newCellVM = {...cellVM};
            if (cellVM.inputBlockShow !== visible) {
                if (visible) {
                    // Show the cell, the rest of the function will add on correct collapse state
                    newCellVM.inputBlockShow = true;
                } else {
                    // Hide this cell
                    newCellVM.inputBlockShow = false;
                }
            }

            // No elseif as we want newly visible cells to pick up the correct expand / collapse state
            if (cellVM.inputBlockOpen !== expanded && cellVM.inputBlockCollapseNeeded && cellVM.inputBlockShow) {
                if (expanded) {
                    // Expand the cell
                    const newText = extractInputText(cellVM.cell, getSettings());

                    newCellVM.inputBlockOpen = true;
                    newCellVM.inputBlockText = newText;
                } else {
                    // Collapse the cell
                    let newText = extractInputText(cellVM.cell, getSettings());
                    if (newText.length > 0) {
                        newText = newText.split('\n', 1)[0];
                        newText = newText.slice(0, 255); // Slice to limit length, slicing past length is fine
                        newText = newText.concat('...');
                    }

                    newCellVM.inputBlockOpen = false;
                    newCellVM.inputBlockText = newText;
                }
            }

            return newCellVM;
        }

        return cellVM;
    }

    private sendInfo = () => {
        const info : IHistoryInfo = {
            cellCount: this.getNonEditCellVMs().length,
            undoCount: this.state.undoStack.length,
            redoCount: this.state.redoStack.length
        };
        this.sendMessage(HistoryMessages.SendInfo, info);
    }

    private updateOrAdd = (cell: ICell, allowAdd? : boolean) => {
        const index = this.state.cellVMs.findIndex((c : ICellViewModel) => {
            return c.cell.id === cell.id &&
                   c.cell.line === cell.line &&
                   c.cell.file === cell.file;
            });
        if (index >= 0) {
            // Update this cell
            this.state.cellVMs[index].cell = cell;

            // Also update the last cell execution count. It may have changed
            const editCell = this.getEditCell();
            if (editCell) {
                editCell.cell.data.execution_count = this.getInputExecutionCount(this.state.cellVMs);
            }

            this.forceUpdate();
        } else if (allowAdd) {
            // This is an entirely new cell (it may have started out as finished)
            this.addCell(cell);
        }
    }

    private isCellSupported(cell: ICell) : boolean {
        return !this.props.testMode || cell.data.cell_type !== 'sys_info';
    }

    // tslint:disable-next-line:no-any
    private finishCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }

        // After the cell is finished update our current execution count
        this.currentExecutionCount = this.getCurrentExecutionCount(this.state.cellVMs);

        // When a cell is finished refresh our variables
        // Use the ref here to maintain var explorer independence
        if (this.variableExplorerRef.current && this.variableExplorerRef.current.state.open) {
            this.refreshVariables();
        }
    }

    // tslint:disable-next-line:no-any
    private startCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, true);
            }
        }
    }

    // tslint:disable-next-line:no-any
    private updateCell = (payload?: any) => {
        if (payload) {
            const cell = payload as ICell;
            if (cell && this.isCellSupported(cell)) {
                this.updateOrAdd(cell, false);
            }
        }
    }

    // Check our list of cell vms to see what our current execution count is
    private getCurrentExecutionCount = (cellVMs: ICellViewModel[]): number => {
        const realCells = cellVMs.filter(c => c.cell.data.cell_type === 'code' && !c.editable && c.cell.data.execution_count);
        return realCells && realCells.length > 0 ? parseInt(realCells[realCells.length - 1].cell.data.execution_count!.toString(), 10) : 0;
    }

    private getInputExecutionCount = (cellVMs: ICellViewModel[]) : number => {
        return this.getCurrentExecutionCount(cellVMs) + 1;
    }

    private submitInput = (code: string) => {
        // This should be from our last entry. Switch this entry to read only, and add a new item to our list
        let editCell = this.getEditCell();
        if (editCell) {
            // Change this editable cell to not editable.
            editCell.cell.state = CellState.executing;
            editCell.cell.data.source = code;

            // Change type to markdown if necessary
            const split = code.splitLines({trim: false});
            const firstLine = split[0];
            const matcher = new CellMatcher(getSettings());
            if (matcher.isMarkdown(firstLine)) {
                editCell.cell.data.cell_type = 'markdown';
                editCell.cell.data.source = generateMarkdownFromCodeLines(split);
                editCell.cell.state = CellState.finished;
            }

            // Update input controls (always show expanded since we just edited it.)
            editCell = createCellVM(editCell.cell, getSettings(), this.inputBlockToggled);
            const collapseInputs = getSettings().collapseCellInputCodeByDefault;
            editCell = this.alterCellVM(editCell, true, !collapseInputs);

            // Generate a new id (as the edit cell always has the same one)
            editCell.cell.id = uuid();

            // Indicate this is direct input so that we don't hide it if the user has
            // hide all inputs turned on.
            editCell.directInput = true;

            // Stick in a new cell at the bottom that's editable and update our state
            // so that the last cell becomes busy
            this.setState({
                cellVMs: [...this.state.cellVMs, editCell],
                editCellVM: createEditableCellVM(this.getInputExecutionCount(this.state.cellVMs)),
                undoStack : this.pushStack(this.state.undoStack, this.state.cellVMs),
                redoStack: this.state.redoStack,
                skipNextScroll: false,
                submittedText: true
            });

            // Send a message to execute this code if necessary.
            if (editCell.cell.state !== CellState.finished) {
                this.sendMessage(HistoryMessages.SubmitNewCell, { code, id: editCell.cell.id });
            }
        }
    }

    private variableExplorerToggled = (open: boolean) => {
        this.sendMessage(HistoryMessages.VariableExplorerToggle, open);
    }

    // When the variable explorer wants to refresh state (say if it was expanded)
    private refreshVariables = () => {
        this.sendMessage(HistoryMessages.GetVariablesRequest, this.currentExecutionCount);
    }

    // Find the display value for one specific variable
    private refreshVariable = (targetVar: IJupyterVariable) => {
        this.sendMessage(HistoryMessages.GetVariableValueRequest, targetVar);
    }

    // When we get a variable value back use the ref to pass to the variable explorer
    // tslint:disable-next-line:no-any
    private getVariableValueResponse = (payload?: any) => {
        if (payload) {
            const variable = payload as IJupyterVariable;

            // Only send the updated variable data if we are on the same execution count as when we requsted it
            if (variable && variable.executionCount !== undefined && variable.executionCount === this.currentExecutionCount) {
                if (this.variableExplorerRef.current) {
                    this.variableExplorerRef.current.newVariableData(variable);
                }
            }
        }
    }

    // When we get our new set of variables back use the ref to pass to the variable explorer
    // tslint:disable-next-line:no-any
    private getVariablesResponse = (payload?: any) => {
        if (payload) {
            const variablesResponse = payload as IJupyterVariablesResponse;

            // Check to see if we have moved to a new execution count only send our update if we are on the same count as the request
            if (variablesResponse.executionCount === this.currentExecutionCount) {
                if (this.variableExplorerRef.current) {
                    this.variableExplorerRef.current.newVariablesData(variablesResponse.variables);
                }

                // Now put out a request for all of the sub values for the variables
                variablesResponse.variables.forEach(this.refreshVariable);
            }
        }
    }

    private codeChange = (changes: monacoEditor.editor.IModelContentChange[], id: string, modelId: string) => {
        // If the model id doesn't match, skip sending this edit. This happens
        // when a cell is reused after deleting another
        const expectedCellId = this.monacoIdToCellId.get(modelId);
        if (expectedCellId !== id) {
            // A cell has been reused. Update our mapping
            this.monacoIdToCellId.set(modelId, id);
        } else {
            // Just a normal edit. Pass this onto the completion provider running in the extension
            this.sendMessage(HistoryMessages.EditCell, { changes, id });
        }
    }

    private readOnlyCodeCreated = (text: string, file: string, id: string, monacoId: string) => {
        // Pass this onto the completion provider running in the extension
        this.sendMessage(HistoryMessages.AddCell, { text, file, id });

        // Save in our map of monaco id to cell id
        this.monacoIdToCellId.set(monacoId, id);
    }

    private editableCodeCreated = (_text: string, _file: string, id: string, monacoId: string) => {
        // Save in our map of monaco id to cell id
        this.monacoIdToCellId.set(monacoId, id);
    }

    private getCellId = (monacoId: string) : string => {
        const result = this.monacoIdToCellId.get(monacoId);
        if (result) {
            return result;
        }

        // Just assume it's the edit cell if not found.
        return Identifiers.EditCellId;
    }

    // tslint:disable-next-line: no-any
    private tokenizerLoaded = (_e?: any) => {
        this.setState({ tokenizerLoaded: true });
    }

    private loadOnigasm = () : Promise<ArrayBuffer> => {
        if (!this.onigasmPromise) {
            this.onigasmPromise = createDeferred<ArrayBuffer>();
            // Send our load onigasm request
            this.sendMessage(HistoryMessages.LoadOnigasmAssemblyRequest);
        }
        return this.onigasmPromise.promise;
    }

    private loadTmlanguage = () : Promise<string> => {
        if (!this.tmlangugePromise) {
            this.tmlangugePromise = createDeferred<string>();
            // Send our load onigasm request
            this.sendMessage(HistoryMessages.LoadTmLanguageRequest);
        }
        return this.tmlangugePromise.promise;
    }

    // tslint:disable-next-line: no-any
    private handleOnigasmResponse(payload: any) {
        if (payload && this.onigasmPromise) {
            const typedArray = new Uint8Array(payload.data);
            this.onigasmPromise.resolve(typedArray.buffer);
        } else if (this.onigasmPromise) {
            this.onigasmPromise.resolve(undefined);
        }
    }

    // tslint:disable-next-line: no-any
    private handleTmLanguageResponse(payload: any) {
        if (payload && this.tmlangugePromise) {
            this.tmlangugePromise.resolve(payload.toString());
        } else if (this.tmlangugePromise) {
            this.tmlangugePromise.resolve(undefined);
        }
    }
}
