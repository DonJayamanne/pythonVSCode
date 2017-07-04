'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AutoImportProvider } from './providers/autoImportProvider';


export function activate(context: vscode.ExtensionContext, outChannel: vscode.OutputChannel) {
    let extension = new AutoImportProvider();
    context.subscriptions.push(vscode.commands.registerCommand('python.autoImportAtCursor', extension.autoImportAtCursor));
}
