'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

const REGEX = '(?<file>.py):(?<line>\\d+):(?<column>\\d+): \\[(?<type>\\w+)\\] (?<code>\\w\\d+):? (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;

    constructor(outputChannel: OutputChannel, workspaceRootPath?: string) {
        super('pylama', Product.pylama, outputChannel, workspaceRootPath);
    }

    public getExtraLinterArgs(document: TextDocument): string[] {
        return ['--format=parsable', document.uri.fsPath];
    }
}
