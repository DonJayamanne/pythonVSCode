// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as vscode from 'vscode';
import { UseProposedApi } from '../constants';
import { IApplicationEnvironment, IAuthenticationService } from './types';

/**
 * Wrapper for VS code authentication services.
 */
@injectable()
export class AuthenticationService implements IAuthenticationService {
    private unsupportedEvent = new vscode.EventEmitter<void>();
    constructor(
        @inject(UseProposedApi) private readonly useProposedApi: boolean,
        @inject(IApplicationEnvironment) private env: IApplicationEnvironment
    ) {}
    public get onDidChangeAuthenticationProviders(): vscode.Event<vscode.AuthenticationProvidersChangeEvent> {
        return vscode.authentication.onDidChangeAuthenticationProviders;
    }
    public get providerIds(): readonly string[] {
        return vscode.authentication.providerIds;
    }
    public get providers(): readonly vscode.AuthenticationProviderInformation[] {
        return vscode.authentication.providers;
    }
    public get onDidChangePassword(): vscode.Event<void> {
        if (this.useProposedApi && this.env.channel === 'insiders') {
            return vscode.authentication.onDidChangePassword;
        } else {
            return this.unsupportedEvent.event;
        }
    }
    public registerAuthenticationProvider(provider: vscode.AuthenticationProvider): vscode.Disposable {
        return vscode.authentication.registerAuthenticationProvider(provider);
    }
    public getProviderIds(): Thenable<readonly string[]> {
        return vscode.authentication.getProviderIds();
    }
    public logout(providerId: string, sessionId: string): Thenable<void> {
        return vscode.authentication.logout(providerId, sessionId);
    }
    public getPassword(key: string): Thenable<string | undefined> {
        if (this.useProposedApi && this.env.channel === 'insiders') {
            return vscode.authentication.getPassword(key);
        }
        return Promise.resolve(undefined);
    }
    public setPassword(key: string, value: string): Thenable<void> {
        if (this.useProposedApi && this.env.channel === 'insiders') {
            return vscode.authentication.setPassword(key, value);
        }
        return Promise.resolve();
    }
    public deletePassword(key: string): Thenable<void> {
        if (this.useProposedApi && this.env.channel === 'insiders') {
            return vscode.authentication.deletePassword(key);
        }
        return Promise.resolve();
    }
}
