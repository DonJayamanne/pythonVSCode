import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class AutoImportProvider {
    
    constructor() {
    }

    autoImportAtCursor() {
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

        return this.autoImport(symbol);
    }

    async autoImport(symbol: string) {
        let editor = vscode.window.activeTextEditor;
        let result = await this.lookupSymbol(symbol);
            
        result = result.filter((s: vscode.SymbolInformation) =>
            s.name === symbol && // Only exact and case sensitive matches should be considered for import
            s.kind !== vscode.SymbolKind.Namespace  // only declarations should be considered for import
        );
    
        if(result.length === 0) {
            vscode.window.showInformationMessage('No matching symbols found');
            return;
        } else {
            var import_choices: string[] = result.map(
                s => `from ${pathAsPyModule(s.location)} import ${s.name}`
            );

            let s = await this.showChoices(import_choices);
            if(s) {
                return addImport(editor, s); 
            }
        }
    }

    lookupSymbol(symbol: string) {
        return <Promise<vscode.SymbolInformation[]>>
            vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', symbol);
    }

    showChoices(import_choices: string[]) {
        return vscode.window.showQuickPick(import_choices);
    }
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

export function addImport(ed: vscode.TextEditor, import_string: string) {
    return ed.edit((b: vscode.TextEditorEdit) => b.insert(
        getPositionForNewImport(import_string),
        import_string + '\n'
    ));
}


export function getPositionForNewImport(import_string: string): vscode.Position {
    // TODO: figure out better position:
    return new vscode.Position(0, 0);
}