'use strict';
import { OutputChannel } from 'vscode';
import { Installer, Product } from '../../common/installer';
import { InvalidArgumentsErrorHandler } from './invalidArgs';
import { StandardErrorHandler } from './standard';
import { NotInstalledErrorHandler } from './notInstalled';

export class ErrorHandler {
    private _errorHandlers: StandardErrorHandler[] = [];
    constructor(protected id: string, protected product: Product, protected installer: Installer, protected outputChannel: OutputChannel) {
        this._errorHandlers = [
            new InvalidArgumentsErrorHandler(this.id, this.product, this.installer, this.outputChannel),
            new NotInstalledErrorHandler(this.id, this.product, this.installer, this.outputChannel),
            new StandardErrorHandler(this.id, this.product, this.installer, this.outputChannel)
        ];
    }

    public handleError(expectedFileName: string, fileName: string, error: Error) {
        this._errorHandlers.some(handler => handler.handleError(expectedFileName, fileName, error));
    }
}