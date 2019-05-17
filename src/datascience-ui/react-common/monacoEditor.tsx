
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import { IDisposable } from '../../client/common/types';

import './monacoEditor.css';

const LINE_HEIGHT = 18;

export interface IMonacoEditorProps {
    language: string;
    value: string;
    theme?: string;
    outermostParentClass: string;
    options: monacoEditor.editor.IEditorConstructionOptions;
    testMode?: boolean;
    editorMounted(editor: monacoEditor.editor.IStandaloneCodeEditor): void;
}

interface IMonacoEditorState {
    editor?: monacoEditor.editor.IStandaloneCodeEditor;
    model: monacoEditor.editor.ITextModel | null;
}

// Need this to prevent wiping of the current value on a componentUpdate. react-monaco-editor has that problem.

export class MonacoEditor extends React.Component<IMonacoEditorProps, IMonacoEditorState> {
    private containerRef: React.RefObject<HTMLDivElement>;
    private measureWidthRef: React.RefObject<HTMLDivElement>;
    private resizeTimer?: number;
    private leaveTimer?: number;
    private subscriptions: monacoEditor.IDisposable[] = [];
    private widgetParent: HTMLDivElement | undefined;
    private outermostParent: HTMLElement | null = null;
    private enteredHover: boolean = false;
    private lastOffsetLeft: number | undefined;
    private lastOffsetTop: number | undefined;
    constructor(props: IMonacoEditorProps) {
        super(props);
        this.state = { editor: undefined, model: null };
        this.containerRef = React.createRef<HTMLDivElement>();
        this.measureWidthRef = React.createRef<HTMLDivElement>();
    }

    public componentDidMount = () => {
        if (window) {
            window.addEventListener('resize', this.windowResized);
        }
        if (this.containerRef.current) {
            // Compute our outermost parent
            let outerParent = this.containerRef.current.parentElement;
            while (outerParent && !outerParent.classList.contains(this.props.outermostParentClass)) {
                outerParent = outerParent.parentElement;
            }
            this.outermostParent = outerParent;
            if (this.outermostParent) {
                this.outermostParent.addEventListener('mouseleave', this.outermostParentLeave);
            }

            // Create the editor
            const editor = monacoEditor.editor.create(this.containerRef.current,
                {
                    value: this.props.value,
                    language: this.props.language,
                    ...this.props.options
                });

            // Force the editor to behave like a unix editor as
            // all of our code is assuming that.
            const model = editor.getModel();
            if (model) {
                model.setEOL(monacoEditor.editor.EndOfLineSequence.LF);
            }

            // Save the editor and the model in our state.
            this.setState({ editor, model });
            if (this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }

            // do the initial set of the height (wait a bit)
            this.windowResized();

            // on each edit recompute height (wait a bit)
            this.subscriptions.push(editor.onDidChangeModelDecorations(() => {
                this.windowResized();
            }));

            // Setup our context menu to show up outside. Autocomplete doesn't have this problem so it just works
            this.subscriptions.push(editor.onContextMenu((e) => {
                if (this.state.editor) {
                    const domNode = this.state.editor.getDomNode();
                    const contextMenuElement = domNode ? domNode.querySelector('.monaco-menu-container') as HTMLElement : null;
                    if (contextMenuElement) {
                        const posY = (e.event.posy + contextMenuElement.clientHeight) > window.outerHeight
                            ? e.event.posy - contextMenuElement.clientHeight
                            : e.event.posy;
                        const posX = (e.event.posx + contextMenuElement.clientWidth) > window.outerWidth
                            ? e.event.posx - contextMenuElement.clientWidth
                            : e.event.posx;
                        contextMenuElement.style.position = 'fixed';
                        contextMenuElement.style.top = `${Math.max(0, Math.floor(posY))}px`;
                        contextMenuElement.style.left = `${Math.max(0, Math.floor(posX))}px`;
                    }
                }
            }));

            // Make sure our suggest and hover windows show up on top of other stuff
            this.updateWidgetParent(editor);

            // Tell our parent the editor is ready to use
            this.props.editorMounted(editor);
        }
    }

    public componentWillUnmount = () => {
        if (this.resizeTimer) {
            window.clearTimeout(this.resizeTimer);
        }

        if (window) {
            window.removeEventListener('resize', this.windowResized);
        }

        if (this.outermostParent) {
            this.outermostParent.removeEventListener('mouseleave', this.outermostParentLeave);
            this.outermostParent = null;
        }
        if (this.widgetParent) {
            this.widgetParent.remove();
        }

        this.subscriptions.forEach(d => d.dispose());
        if (this.state.editor) {
            this.state.editor.dispose();
        }
    }

    public componentDidUpdate(prevProps: IMonacoEditorProps) {
        if (this.state.editor) {
            if (prevProps.language !== this.props.language && this.state.model) {
                monacoEditor.editor.setModelLanguage(this.state.model, this.props.language);
            }
            if (prevProps.theme !== this.props.theme && this.props.theme) {
                monacoEditor.editor.setTheme(this.props.theme);
            }
            if (prevProps.options !== this.props.options) {
                this.state.editor.updateOptions(this.props.options);
            }
            if (prevProps.value !== this.props.value && this.state.model) {
                this.state.model.setValue(this.props.value);
            }
        }
        this.updateEditorSize();
    }

    public render() {
        return (
            <div className='monaco-editor-outer-container' ref={this.containerRef}>
                <div className='monaco-editor-container' />
                <div className='measure-width-div' ref={this.measureWidthRef} />
            </div>
        );
    }

    private windowResized = () => {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(this.updateEditorSize, 0);
    }

    private startUpdateWidgetPosition = () => {
        this.updateWidgetPosition();
    }

    private updateWidgetPosition(width?: number) {
        if (this.state.editor && this.widgetParent) {
            // Position should be at the top of the editor.
            const editorDomNode = this.state.editor.getDomNode();
            if (editorDomNode) {
                const rect = editorDomNode.getBoundingClientRect();
                if (rect &&
                    (rect.left !== this.lastOffsetLeft || rect.top !== this.lastOffsetTop)) {
                    this.lastOffsetLeft = rect.left;
                    this.lastOffsetTop = rect.top;

                    this.widgetParent.setAttribute(
                        'style',
                        `position: absolute; left: ${rect.left}px; top: ${rect.top}px; width:${width ? width : rect.width}px`);
                }
            }
        }
    }

    private updateEditorSize = () => {
        if (this.measureWidthRef.current &&
            this.measureWidthRef.current.clientWidth &&
            this.containerRef.current &&
            this.containerRef.current.parentElement &&
            this.state.editor &&
            this.state.model) {
            const editorDomNode = this.state.editor.getDomNode();
            if (!editorDomNode) { return; }
            const container = editorDomNode.getElementsByClassName('view-lines')[0] as HTMLElement;
            const lineHeight = container.firstChild
                ? (container.firstChild as HTMLElement).offsetHeight
                : LINE_HEIGHT;
            const currLineCount = this.state.model.getLineCount();
            const height = (currLineCount * lineHeight) + 3; // Fudge factor
            const width = this.measureWidthRef.current.clientWidth - this.containerRef.current.parentElement.offsetLeft - 15; // Leave room for the scroll bar in regular cell table

            // For some reason this is flashing. Need to debug the editor code to see if
            // it draws more than once. Or if we can have React turn off DOM updates
            this.state.editor.layout({ width: width, height: height });

            // Also need to update our widget positions
            this.updateWidgetPosition(width);
        }
    }

    private onHoverLeave = () => {
        // If the hover is active, make sure to hide it.
        if (this.state.editor && this.widgetParent) {
            this.enteredHover = false;
            // tslint:disable-next-line: no-any
            const hover = this.state.editor.getContribution('editor.contrib.hover') as any;
            if (hover._hideWidgets) {
                hover._hideWidgets();
            }
        }
    }

    private onHoverEnter = () => {
        if (this.state.editor && this.widgetParent) {
            // If we enter the hover, indicate it so we don't leave
            this.enteredHover = true;
        }
    }

    private outermostParentLeave = () => {
        // Have to bounce this because the leave for the cell is the
        // enter for the hover
        if (this.leaveTimer) {
            clearTimeout(this.leaveTimer);
        }
        this.leaveTimer = window.setTimeout(this.outermostParentLeaveBounced, 0);
    }

    private outermostParentLeaveBounced = () => {
        if (this.state.editor && !this.enteredHover) {
            // If we haven't already entered hover, then act like it shuts down
            this.onHoverLeave();
        }
    }

    private updateWidgetParent(editor: monacoEditor.editor.IStandaloneCodeEditor) {
        // Reparent the hover widgets. They cannot be inside anything that has overflow hidden or scrolling or they won't show
        // up overtop of anything. Warning, this is a big hack. If the class name changes or the logic
        // for figuring out the position of hover widgets changes, this won't work anymore.
        // appendChild on a DOM node moves it, but doesn't clone it.
        // https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
        const editorNode = editor.getDomNode();
        if (editorNode) {
            try {
                const elements = editorNode.getElementsByClassName('overflowingContentWidgets');
                if (elements && elements.length) {
                    const contentWidgets = elements[0] as HTMLDivElement;
                    if (contentWidgets) {
                        // Go up to the document.
                        const document = contentWidgets.getRootNode() as HTMLDocument;

                        // His first child with the id 'root' should be where we want to parent our overflow widgets
                        if (document) {
                            const root = document.getElementById('root');
                            if (root) {
                                // We need to create a dummy 'monaco-editor' div so that the content widgets get the same styles.
                                this.widgetParent = document.createElement('div', {});
                                this.widgetParent.setAttribute('class', `${editorNode.className} monaco-editor-pretend-parent`);

                                // We also need to make sure its position follows the editor around on the screen.
                                const rect = editorNode.getBoundingClientRect();
                                if (rect) {
                                    this.lastOffsetLeft = rect.left;
                                    this.lastOffsetTop = rect.top;
                                    this.widgetParent.setAttribute(
                                        'style',
                                        `position: absolute; left: ${rect.left}px; top: ${rect.top}px`);
                                }

                                root.appendChild(this.widgetParent);
                                this.widgetParent.appendChild(contentWidgets);

                                // Listen for changes so we can update the position dynamically
                                editorNode.addEventListener('mouseenter', this.startUpdateWidgetPosition);

                                // We also need to trick the editor into thinking mousing over the hover does not
                                // mean the mouse has left the editor.
                                // tslint:disable-next-line: no-any
                                const hover = editor.getContribution('editor.contrib.hover') as any;
                                if (hover._toUnhook && hover._toUnhook.length === 8 && hover.contentWidget) {
                                    // This should mean our 5th element is the event handler for mouse leave. Remove it.
                                    const array = hover._toUnhook as IDisposable[];
                                    array[5].dispose();
                                    array.splice(5, 1);

                                    // Instead listen to mouse leave for our hover widget
                                    const hoverWidget = this.widgetParent.getElementsByClassName('monaco-editor-hover')[0] as HTMLElement;
                                    if (hoverWidget) {
                                        hoverWidget.addEventListener('mouseenter', this.onHoverEnter);
                                        hoverWidget.addEventListener('mouseleave', this.onHoverLeave);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // If something fails, then the hover will just work inside the main frame
                if (!this.props.testMode) {
                    window.console.warn(`Error moving editor widgets: ${e}`);
                }

                // Make sure we don't try moving it around.
                this.widgetParent = undefined;
            }
        }
    }
}
