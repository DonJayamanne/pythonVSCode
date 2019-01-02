// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import './cell.css';

import { nbformat } from '@jupyterlab/coreutils';
import ansiToHtml from 'ansi-to-html';
import * as React from 'react';
import JSONTree from 'react-json-tree';

import { concatMultilineString } from '../../client/datascience/common';
import { CellState, ICell } from '../../client/datascience/types';
import { getLocString } from '../react-common/locReactSide';
import { CellButton } from './cellButton';
import { Code } from './code';
import { CollapseButton } from './collapseButton';
import { ExecutionCount } from './executionCount';
import { Image, ImageName } from './image';
import { MenuBar } from './menuBar';
import { SysInfo } from './sysInfo';
import { displayOrder, richestMimetype, transforms } from './transforms';

// tslint:disable-next-line:match-default-export-name import-name
interface ICellProps {
    cellVM: ICellViewModel;
    theme: string;
    gotoCode(): void;
    delete(): void;
}

export interface ICellViewModel {
    cell: ICell;
    inputBlockOpen: boolean;
    inputBlockText: string;
    inputBlockCollapseNeeded: boolean;
    inputBlockToggled(id: string): void;
}

export class Cell extends React.Component<ICellProps> {
    constructor(prop: ICellProps) {
        super(prop);
    }

    public render() {
        if (this.props.cellVM.cell.data.cell_type === 'sys_info') {
            return <SysInfo theme={this.props.theme} connection={this.props.cellVM.cell.data.connection} path={this.props.cellVM.cell.data.path} message={this.props.cellVM.cell.data.message} version={this.props.cellVM.cell.data.version} notebook_version={this.props.cellVM.cell.data.notebook_version}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    // Public for testing
    public getUnknownMimeTypeString = () => {
        return getLocString('DataScience.unknownMimeType', 'Unknown Mime Type');
    }

    private toggleInputBlock = () => {
        const cellId: string = this.getCell().id;
        this.props.cellVM.inputBlockToggled(cellId);
    }

    private getDeleteString = () => {
        return getLocString('DataScience.deleteButtonTooltip', 'Remove Cell');
    }

    private getGoToCodeString = () => {
        return getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code');
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private hasOutput = () => {
        return this.getCell().state === CellState.finished || this.getCell().state === CellState.error || this.getCell().state === CellState.executing;
    }

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    }

    private getMarkdownCell = () => {
        return this.props.cellVM.cell.data as nbformat.IMarkdownCell;
    }

    private renderNormalCell() {

        return (
            <div className='cell-wrapper'>
                <MenuBar theme={this.props.theme}>
                    <CellButton theme={this.props.theme} onClick={this.props.delete} tooltip={this.getDeleteString()}>
                        <Image theme={this.props.theme} class='cell-button-image' image={ImageName.Cancel}/>
                    </CellButton>
                    <CellButton theme={this.props.theme} onClick={this.props.gotoCode} tooltip={this.getGoToCodeString()}>
                        <Image theme={this.props.theme} class='cell-button-image' image={ImageName.GoToSourceCode}/>
                    </CellButton>
                </MenuBar>
                <div className='cell-outer'>
                    <div className='controls-div'>
                        <div className='controls-flex'>
                            <ExecutionCount cell={this.props.cellVM.cell} theme={this.props.theme} visible={this.isCodeCell()}/>
                            <CollapseButton theme={this.props.theme} hidden={this.props.cellVM.inputBlockCollapseNeeded}
                                open={this.props.cellVM.inputBlockOpen} onClick={this.toggleInputBlock}
                                tooltip={getLocString('DataScience.collapseInputTooltip', 'Collapse input block')}/>
                        </div>
                    </div>
                    <div className='content-div'>
                        <div className='cell-result-container'>
                            {this.renderInputs()}
                            {this.renderResults()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private renderInputs = () => {
        if (this.isCodeCell()) {
            // Colorize our text
            return (<div className='cell-input'><Code code={this.props.cellVM.inputBlockText} theme={this.props.theme}/></div>);
        } else {
            return null;
        }
    }

    private renderResults = () => {
        const outputClassNames = this.isCodeCell() ?
            `cell-output cell-output-${this.props.theme}` :
            '';

        // Results depend upon the type of cell
        const results = this.isCodeCell() ?
            this.renderCodeOutputs() :
            this.renderMarkdown(this.getMarkdownCell());

        // Then combine them inside a div
        return <div className={outputClassNames}>{results}</div>;
    }
    private renderCodeOutputs = () => {
        if (this.isCodeCell() && this.hasOutput()) {
            // Render the outputs
            return this.getCodeCell().outputs.map((output: nbformat.IOutput, index: number) => {
                return this.renderOutput(output, index);
            });

        }
    }

    private renderMarkdown = (markdown : nbformat.IMarkdownCell) => {
        // React-markdown expects that the source is a string
        const source = concatMultilineString(markdown.source);
        const Transform = transforms['text/markdown'];

        return <Transform data={source}/>;
    }

    private renderWithTransform = (mimetype: string, output : nbformat.IOutput, index : number) => {

        // If we found a mimetype, use the transform
        if (mimetype) {

            // Get the matching React.Component for that mimetype
            const Transform = transforms[mimetype];

            if (typeof mimetype !== 'string') {
                return <div key={index}>{this.getUnknownMimeTypeString()}</div>;
            }

            try {
                // Text/plain has to be massaged. It expects a continuous string
                if (output.data) {
                    let data = output.data[mimetype];
                    if (mimetype === 'text/plain') {
                        data = concatMultilineString(data);
                    }

                    // Return the transformed control using the data we massaged
                    return <Transform key={index} data={data} />;
                }
            } catch (ex) {
                window.console.log('Error in rendering');
                window.console.log(ex);
                return <div></div>;
            }
        }

        return <div></div>;
    }

    private renderOutput = (output : nbformat.IOutput, index: number) => {
        // Borrowed this from Don's Jupyter extension

        // First make sure we have the mime data
        if (!output) {
          return <div key={index}/>;
        }

        // Make a copy of our data so we don't modify our cell
        const copy = {...output};

        // Special case for json
        if (copy.data && copy.data['application/json']) {
          return <JSONTree key={index} data={copy.data} />;
        }

        // Stream and error output need to be converted
        if (copy.output_type === 'stream') {
            const stream = copy as nbformat.IStream;
            const text = concatMultilineString(stream.text);
            copy.data = {
                'text/html' : text
            };
        } else if (copy.output_type === 'error') {
            const error = copy as nbformat.IError;
            try {
                const converter = new ansiToHtml();
                const trace = converter.toHtml(error.traceback.join('\n'));
                copy.data = {
                    'text/html': trace
                };
            } catch {
                // This can fail during unit tests, just use the raw data
                copy.data = {
                    'text/html': error.evalue
                };

            }
        }

        // Jupyter style MIME bundle

        // Find out which mimetype is the richest
        const mimetype: string = richestMimetype(copy.data, displayOrder, transforms);

        // If that worked, use the transform
        if (mimetype) {
            return this.renderWithTransform(mimetype, copy, index);
        }

        const str : string = this.getUnknownMimeTypeString();
        return <div key={index}>${str}</div>;
    }
}
