// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './nativeEditor.less';

import * as React from 'react';

import { noop } from '../../client/common/utils/misc';
import { NativeCommandType } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { ContentPanel, IContentPanelProps } from '../interactive-common/contentPanel';
import { ICellViewModel, IMainState } from '../interactive-common/mainState';
import { IVariablePanelProps, VariablePanel } from '../interactive-common/variablePanel';
import { ErrorBoundary } from '../react-common/errorBoundary';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { Progress } from '../react-common/progress';
import { getSettings } from '../react-common/settingsReactSide';
import { AddCellLine } from './addCellLine';
import { NativeCell } from './nativeCell';
import { NativeEditorStateController } from './nativeEditorStateController';

// See the discussion here: https://github.com/Microsoft/tslint-microsoft-contrib/issues/676
// tslint:disable: react-this-binding-issue
// tslint:disable-next-line:no-require-imports no-var-requires
const debounce = require('lodash/debounce') as typeof import('lodash/debounce');

interface INativeEditorProps {
    skipDefault: boolean;
    testMode?: boolean;
    codeTheme: string;
    baseTheme: string;
}

export class NativeEditor extends React.Component<INativeEditorProps, IMainState> {
    // Public so can access it from test code
    public stateController: NativeEditorStateController;
    private renderCount: number = 0;
    private mainPanelRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private contentPanelScrollRef: React.RefObject<HTMLElement> = React.createRef<HTMLElement>();
    private contentPanelRef: React.RefObject<ContentPanel> = React.createRef<ContentPanel>();
    private debounceUpdateVisibleCells = debounce(this.updateVisibleCells.bind(this), 100);
    private cellRefs: Map<string, React.RefObject<NativeCell>> = new Map<string, React.RefObject<NativeCell>>();
    private cellContainerRefs: Map<string, React.RefObject<HTMLDivElement>> = new Map<string, React.RefObject<HTMLDivElement>>();
    private initialVisibilityUpdate: boolean = false;

    constructor(props: INativeEditorProps) {
        super(props);

        // Create our state controller. It manages updating our state.
        this.stateController = new NativeEditorStateController({
            skipDefault: this.props.skipDefault,
            testMode: this.props.testMode ? true : false,
            expectingDark: this.props.baseTheme !== 'vscode-light',
            setState: this.setState.bind(this),
            activate: this.activated.bind(this),
            scrollToCell: this.scrollToCell.bind(this),
            defaultEditable: true,
            hasEdit: false,
            enableGather: false
        });

        // Default our state.
        this.state = this.stateController.getState();
    }

    public shouldComponentUpdate(_nextProps: INativeEditorProps, nextState: IMainState): boolean {
        return this.stateController.requiresUpdate(this.state, nextState);
    }

    public componentDidMount() {
        window.addEventListener('keydown', this.mainKeyDown);
        window.addEventListener('resize', () => this.forceUpdate(), true);
    }

    public componentWillUnmount() {
        window.removeEventListener('keydown', this.mainKeyDown);
        window.removeEventListener('resize', () => this.forceUpdate());
        // Dispose of our state controller so it stops listening
        this.stateController.dispose();
    }

    public render() {
        const dynamicFont: React.CSSProperties = {
            fontSize: this.state.font.size,
            fontFamily: this.state.font.family
        };

        // If in test mode, update our count. Use this to determine how many renders a normal update takes.
        if (this.props.testMode) {
            this.renderCount = this.renderCount + 1;
        }

        // Update the state controller with our new state
        this.stateController.renderUpdate(this.state);
        const progressBar = this.state.busy && !this.props.testMode ? <Progress /> : undefined;
        const insertAboveFirst = () => {
            const cellId = this.state.cellVMs.length > 0 ? this.state.cellVMs[0].cell.id : undefined;
            const newCell = this.stateController.insertAbove(cellId, true);
            if (newCell) {
                // Make async because the click changes focus.
                setTimeout(() => this.focusCell(newCell, true), 10);
            }
        };
        const addCellLine = this.state.cellVMs.length === 0 ? null :
            <AddCellLine includePlus={true} className='add-cell-line-top' click={insertAboveFirst} baseTheme={this.props.baseTheme}/>;

        return (
            <div id='main-panel' ref={this.mainPanelRef} role='Main' style={dynamicFont}>
                <div className='styleSetter'>
                    <style>
                        {this.state.rootCss}
                    </style>
                </div>
                <header id='main-panel-toolbar'>
                    {this.renderToolbarPanel()}
                    {progressBar}
                </header>
                <section id='main-panel-variable' aria-label={getLocString('DataScience.collapseVariableExplorerLabel', 'Variables')}>
                    {this.renderVariablePanel(this.props.baseTheme)}
                </section>
                <main id='main-panel-content' onScroll={this.onContentScroll} ref={this.contentPanelScrollRef}>
                    {addCellLine}
                    {this.renderContentPanel(this.props.baseTheme)}
                </main>
            </div>
        );
    }

    private activated = () => {
        // Make sure the input cell gets focus
        if (getSettings && getSettings().allowInput) {
            // Delay this so that we make sure the outer frame has focus first.
            setTimeout(() => {
                // First we have to give ourselves focus (so that focus actually ends up in the code cell)
                if (this.mainPanelRef && this.mainPanelRef.current) {
                    this.mainPanelRef.current.focus({preventScroll: true});
                }
            }, 100);
        }
    }

    private scrollToCell(_id: string) {
        // Not used in the native editor
        noop();
    }

    private moveSelectionToExisting = (cellId: string) => {
        // Cell should already exist in the UI
        if (this.contentPanelRef) {
            const wasFocused = this.state.focusedCellId !== undefined;
            this.stateController.selectCell(cellId, wasFocused ? cellId : undefined);
            this.focusCell(cellId, wasFocused ? true : false);
        }
    }

    private selectCell = (id: string) => {
        // Check to see that this cell already exists in our window (it's part of the rendered state)
        const cells = this.state.cellVMs.map(c => c.cell).filter(c => c.data.cell_type !== 'messages');
        if (cells.find(c => c.id === id)) {
            // Force selection change right now as we don't need the cell to exist
            // to make it selected (otherwise we'll get a flash)
            const wasFocused = this.state.focusedCellId !== undefined;
            this.stateController.selectCell(id, wasFocused ? id : undefined);

            // Then wait to give it actual input focus
            setTimeout(() => this.moveSelectionToExisting(id), 1);
        } else {
            this.moveSelectionToExisting(id);
        }
    }

    // tslint:disable: react-this-binding-issue
    private renderToolbarPanel() {
        const addCell = () => {
            const newCell = this.stateController.addNewCell();
            this.stateController.sendCommand(NativeCommandType.AddToEnd, 'mouse');
            if (newCell) {
                this.stateController.selectCell(newCell.cell.id, newCell.cell.id);
            }
        };
        const runAll = () => {
            this.stateController.runAll();
            this.stateController.sendCommand(NativeCommandType.RunAll, 'mouse');
        };
        const toggleVariableExplorer = () => {
            this.stateController.toggleVariableExplorer();
            this.stateController.sendCommand(NativeCommandType.ToggleVariableExplorer, 'mouse');
        };
        const variableExplorerTooltip = this.state.variablesVisible ?
            getLocString('DataScience.collapseVariableExplorerTooltip', 'Hide variables active in jupyter kernel') :
            getLocString('DataScience.expandVariableExplorerTooltip', 'Show variables active in jupyter kernel');

        return (
            <div id='toolbar-panel'>
                <div className='toolbar-menu-bar'>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.restartKernel} className='native-button' tooltip={getLocString('DataScience.restartServer', 'Restart IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Restart} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.interruptKernel} className='native-button' tooltip={getLocString('DataScience.interruptKernel', 'Interrupt IPython kernel')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Interrupt} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={addCell} className='native-button' tooltip={getLocString('DataScience.addNewCell', 'Insert cell')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.InsertBelow} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={runAll} className='native-button' tooltip={getLocString('DataScience.runAll', 'Run All Cells')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.RunAll} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.clearAllOutputs} disabled={!this.stateController.canClearAllOutputs} className='native-button' tooltip={getLocString('DataScience.clearAllOutput', 'Clear All Output')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ClearAllOutput} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={toggleVariableExplorer} className='native-button' tooltip={variableExplorerTooltip}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.VariableExplorer} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.save} disabled={!this.state.dirty} className='native-button' tooltip={getLocString('DataScience.save', 'Save File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.SaveAs} />
                    </ImageButton>
                    <ImageButton baseTheme={this.props.baseTheme} onClick={this.stateController.export} disabled={!this.stateController.canExport()} className='save-button' tooltip={getLocString('DataScience.exportAsPythonFileTooltip', 'Save As Python File')}>
                        <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.ExportToPython} />
                    </ImageButton>
                </div>
                <div className='toolbar-divider'/>
            </div>
        );
    }

    private renderVariablePanel(baseTheme: string) {
        if (this.state.variablesVisible) {
            const variableProps = this.getVariableProps(baseTheme);
            return <VariablePanel {...variableProps} />;
        }

        return null;
    }

    private renderContentPanel(baseTheme: string) {
        // Skip if the tokenizer isn't finished yet. It needs
        // to finish loading so our code editors work.
        if (!this.state.tokenizerLoaded && !this.props.testMode) {
            return null;
        }

        // Otherwise render our cells.
        const contentProps = this.getContentProps(baseTheme);
        return <ContentPanel {...contentProps} ref={this.contentPanelRef}/>;
    }

    private getContentProps = (baseTheme: string): IContentPanelProps => {
        return {
            baseTheme: baseTheme,
            cellVMs: this.state.cellVMs,
            history: this.state.history,
            testMode: this.props.testMode,
            codeTheme: this.props.codeTheme,
            submittedText: this.state.submittedText,
            skipNextScroll: this.state.skipNextScroll ? true : false,
            editable: true,
            renderCell: this.renderCell,
            scrollToBottom: this.scrollDiv
        };
    }
    private getVariableProps = (baseTheme: string): IVariablePanelProps => {
       return {
        variables: this.state.variables,
        pendingVariableCount: this.state.pendingVariableCount,
        debugging: this.state.debugging,
        busy: this.state.busy,
        showDataExplorer: this.stateController.showDataViewer,
        skipDefault: this.props.skipDefault,
        testMode: this.props.testMode,
        closeVariableExplorer: this.stateController.toggleVariableExplorer,
        baseTheme: baseTheme
       };
    }

    private onContentScroll = (_event: React.UIEvent<HTMLDivElement>) => {
        if (this.contentPanelScrollRef.current) {
            this.debounceUpdateVisibleCells();
        }
    }

    private updateVisibleCells()  {
        if (this.contentPanelScrollRef.current && this.cellContainerRefs.size !== 0) {
            const visibleTop = this.contentPanelScrollRef.current.offsetTop + this.contentPanelScrollRef.current.scrollTop;
            const visibleBottom = visibleTop + this.contentPanelScrollRef.current.clientHeight;
            const cellVMs = [...this.state.cellVMs];

            // Go through the cell divs and find the ones that are suddenly visible
            let makeChange = false;
            for (let i = 0; i < cellVMs.length; i += 1) {
                const cellVM = cellVMs[i];
                if (cellVM.useQuickEdit && this.cellRefs.has(cellVM.cell.id)) {
                    const ref = this.cellContainerRefs.get(cellVM.cell.id);
                    if (ref && ref.current) {
                        const top = ref.current.offsetTop;
                        const bottom = top + ref.current.offsetHeight;
                        if (top > visibleBottom) {
                            break;
                        } else if (bottom < visibleTop) {
                            continue;
                        } else {
                            cellVMs[i] = {...cellVM, useQuickEdit: false };
                            makeChange = true;
                        }
                    }
                }
            }

            // update our state so that newly visible items appear
            if (makeChange) {
                this.setState({cellVMs});
            }
        }
    }

    private mainKeyDown = (event: KeyboardEvent) => {
        // Handler for key down presses in the main panel
        switch (event.key) {
            // tslint:disable-next-line: no-suspicious-comment
            // TODO: How to have this work for when the keyboard shortcuts are changed?
            case 's':
                if (event.ctrlKey) {
                    // This is save, save our cells
                    this.stateController.save();
                }
                break;

            default:
                break;
        }
    }

    // private copyToClipboard = (cellId: string) => {
    //     const cell = this.stateController.findCell(cellId);
    //     if (cell) {
    //         // Need to do this in this process so it copies to the user's clipboard and not
    //         // the remote clipboard where the extension is running
    //         const textArea = document.createElement('textarea');
    //         textArea.value = concatMultilineString(cell.cell.data.source);
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Copy');
    //         textArea.remove();
    //     }
    // }

    // private pasteFromClipboard = (cellId: string) => {
    //     const editedCells = this.state.cellVMs;
    //     const index = editedCells.findIndex(x => x.cell.id === cellId) + 1;

    //     if (index > -1) {
    //         const textArea = document.createElement('textarea');
    //         document.body.appendChild(textArea);
    //         textArea.select();
    //         document.execCommand('Paste');
    //         editedCells[index].cell.data.source = textArea.value.split(/\r?\n/);
    //         textArea.remove();
    //     }

    //     this.setState({
    //         cellVMs: editedCells
    //     });
    // }

    private renderCell = (cellVM: ICellViewModel, index: number): JSX.Element | null => {
        const cellRef : React.RefObject<NativeCell> = React.createRef<NativeCell>();
        const containerRef = React.createRef<HTMLDivElement>();
        this.cellRefs.set(cellVM.cell.id, cellRef);
        this.cellContainerRefs.set(cellVM.cell.id, containerRef);
        const addNewCell = () => {
            const newCell = this.stateController.insertBelow(cellVM.cell.id, true);
            this.stateController.sendCommand(NativeCommandType.AddToEnd, 'mouse');
            if (newCell) {
                // Has to be async because the click will change the focus on mouse up
                setTimeout(() => this.focusCell(newCell, true), 10);
            }
        };
        const lastLine = index === this.state.cellVMs.length - 1 ?
            <AddCellLine
                includePlus={true}
                baseTheme={this.props.baseTheme}
                className='add-cell-line-cell'
                click={addNewCell} /> : null;

        // Special case, see if our initial load is finally complete.
        if (this.state.loadTotal && this.cellRefs.size >= this.state.loadTotal && !this.initialVisibilityUpdate) {
            // We are finally at the point where we have rendered all visible cells. Try fixing up their visible state
            this.initialVisibilityUpdate = true;
            this.debounceUpdateVisibleCells();
        }
        return (
            <div key={index} id={cellVM.cell.id} ref={containerRef}>
                <ErrorBoundary key={index}>
                    <NativeCell
                        ref={cellRef}
                        role='listitem'
                        stateController={this.stateController}
                        maxTextSize={getSettings().maxOutputSize}
                        autoFocus={false}
                        testMode={this.props.testMode}
                        cellVM={cellVM}
                        baseTheme={this.props.baseTheme}
                        codeTheme={this.props.codeTheme}
                        monacoTheme={this.state.monacoTheme}
                        focusCell={this.focusCell}
                        selectCell={this.selectCell}
                        lastCell={lastLine !== null}
                        font={this.state.font}
                    />
                </ErrorBoundary>
                {lastLine}
            </div>);
    }

    private focusCell = (cellId: string, focusCode: boolean): void => {
        this.stateController.selectCell(cellId, focusCode ? cellId : undefined);
        const ref = this.cellRefs.get(cellId);
        if (ref && ref.current) {
            ref.current.giveFocus(focusCode);
        }
    }

    private scrollDiv = (_div: HTMLDivElement) => {
        if (this.state.newCellId) {
            const newCell = this.state.newCellId;
            this.stateController.setState({newCell: undefined});
            // Bounce this so state has time to update.
            setTimeout(() => {
                this.focusCell(newCell, true);
            }, 10);
        }
    }
}
