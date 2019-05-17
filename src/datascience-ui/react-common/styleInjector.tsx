// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';

import { CssMessages, IGetCssResponse, IGetMonacoThemeResponse, SharedMessages } from '../../client/datascience/constants';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import { IMessageHandler, PostOffice } from './postOffice';
import { getSettings } from './settingsReactSide';
import { detectBaseTheme } from './themeDetector';

export interface IStyleInjectorProps {
    expectingDark: boolean;
    postOffice: PostOffice;
    darkChanged?(newDark: boolean): void;
    monacoThemeChanged?(theme: string): void;
}

interface IStyleInjectorState {
    rootCss?: string;
    theme?: string;
    knownDark?: boolean;
}

export class StyleInjector extends React.Component<IStyleInjectorProps, IStyleInjectorState> implements IMessageHandler {

    constructor(props: IStyleInjectorProps) {
        super(props);
        this.state = { rootCss: undefined, theme: undefined };
    }

    public componentWillMount() {
        // Add ourselves as a handler for the post office
        this.props.postOffice.addHandler(this);
    }

    public componentWillUnmount() {
        // Remove ourselves as a handler for the post office
        this.props.postOffice.removeHandler(this);
    }

    public componentDidMount() {
        if (!this.state.rootCss) {
            // Set to a temporary value.
            this.setState({rootCss: ' '});
            this.props.postOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.props.expectingDark });
            this.props.postOffice.sendUnsafeMessage(CssMessages.GetMonacoThemeRequest, { isDark: this.props.expectingDark });
        }
    }

    public render() {
        return (
            <div className='styleSetter'>
                <style>
                    {this.state.rootCss}
                </style>
                {this.props.children}
            </div>
        );
    }

    // tslint:disable-next-line:no-any
    public handleMessage = (msg: string, payload?: any) : boolean => {
        switch (msg) {
            case CssMessages.GetCssResponse:
                this.handleCssResponse(payload);
                break;

            case CssMessages.GetMonacoThemeResponse:
                this.handleMonacoThemeResponse(payload);
                break;

            case SharedMessages.UpdateSettings:
                this.updateSettings(payload);
                break;

            default:
                break;
        }

        return true;
    }

    // tslint:disable-next-line:no-any
    private handleCssResponse(payload?: any) {
        const response = payload as IGetCssResponse;
        if (response && response.css) {

            // Recompute our known dark value from the class name in the body
            // VS code should update this dynamically when the theme changes
            const computedKnownDark = this.computeKnownDark();

            // We also get this in our response, but computing is more reliable
            // than searching for it.

            if (this.state.knownDark !== computedKnownDark &&
                this.props.darkChanged) {
                this.props.darkChanged(computedKnownDark);
            }

            this.setState({
                rootCss: response.css,
                theme: response.theme,
                knownDark: computedKnownDark
            });
        }
    }

    // tslint:disable-next-line: no-any
    private handleMonacoThemeResponse(payload?: any) {
        const response = payload as IGetMonacoThemeResponse;
        if (response && response.theme) {

            // Tell monaco we have a new theme. THis is like a state update for monaco
            monacoEditor.editor.defineTheme('interactiveWindow', response.theme);

            // Tell the main panel we have a theme now
            if (this.props.monacoThemeChanged) {
                this.props.monacoThemeChanged('interactiveWindow');
            }
        }
    }

    // tslint:disable-next-line:no-any
    private updateSettings(payload: any) {
        if (payload) {
            const newSettings = JSON.parse(payload as string);
            const dsSettings = newSettings as IDataScienceExtraSettings;
            if (dsSettings && dsSettings.extraSettings && dsSettings.extraSettings.theme !== this.state.theme) {
                // User changed the current theme. Rerender
                this.props.postOffice.sendUnsafeMessage(CssMessages.GetCssRequest, { isDark: this.computeKnownDark() });
                this.props.postOffice.sendUnsafeMessage(CssMessages.GetMonacoThemeRequest, { isDark: this.computeKnownDark() });
            }
        }
    }

    private computeKnownDark() : boolean {
        const ignore = getSettings && getSettings().ignoreVscodeTheme ? true : false;
        const baseTheme = ignore ? 'vscode-light' : detectBaseTheme();
        return baseTheme !== 'vscode-light';
    }
}
