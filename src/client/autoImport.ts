'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export function activate(context: vscode.ExtensionContext, outChannel: vscode.OutputChannel) {
    context.subscriptions.push(vscode.commands.registerCommand('python.autoImportAtCursor', () => autoImportAtCursor(context, outChannel)));
}

export function autoImportAtCursor(context: vscode.ExtensionContext, outChannel: vscode.OutputChannel) {
    let ed = vscode.window.activeTextEditor;
    let range : vscode.Range = ed.selection;

    if(range.start.line !== range.end.line) {
        return;
    }
    
    if(range.start.character === range.end.character) {
        range = ed.document.getWordRangeAtPosition(range.end);
    }
    const symbol = vscode.window.activeTextEditor.document.getText(range);

    if(!symbol) {
        return;
    }

    autoImport(context, outChannel, symbol);
}

export function autoImport(context: vscode.ExtensionContext, outChannel: vscode.OutputChannel, symbol: string) {
    vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', symbol).then((result: vscode.SymbolInformation[]) => {
        
        result = result.filter((s: vscode.SymbolInformation) =>
            s.name === symbol && // Only exact and case sensitive matches should be considered for import
            s.kind !== vscode.SymbolKind.Namespace  // only declarations should be considered for import
        );
    
        if(result.length === 0) {
            vscode.window.showInformationMessage('No matching symbols found');
            return;
        }
        var import_choices: string[] = result.map(getImportString);

        vscode.window.showQuickPick(import_choices).then(function(s: string|undefined) {
            if(s) {
                addImport(context, outChannel, s); 
            }
        });
    });
}

export function getImportString(s: vscode.SymbolInformation): string {
    return 'from ' + pathAsPyModule(s.location) + ' import ' + s.name;
}

export function pathAsPyModule(l: vscode.Location): string {
    var pymodule = path.basename(l.uri.fsPath).replace(/\.py$/, '');
    var location = path.dirname(l.uri.fsPath);
    while(fs.existsSync(path.join(location, '__init__.py'))) {
        pymodule = path.basename(location) + '.' + pymodule;
        location = path.dirname(location);
    }
    return pymodule;
}

export function addImport(context: vscode.ExtensionContext, outChannel: vscode.OutputChannel, import_string: string) {
    let ed = vscode.window.activeTextEditor;
    ed.edit((b: vscode.TextEditorEdit) => b.insert(
        getPositionForImport(import_string),
        import_string + '\n'
    ));
}


export function getPositionForImport(import_string: string): vscode.Position {
    // TODO: figure out better position:
    return new vscode.Position(0, 0);
}