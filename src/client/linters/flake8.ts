'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;

    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('flake8', Product.flake8, outputChannel, workspaceRootPath);
    }

    public getExtraLinterArgs(document: TextDocument): string[] {
        return ['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', document.uri.fsPath];
    }
}
