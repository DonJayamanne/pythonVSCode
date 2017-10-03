"use strict";
import * as vscode from 'vscode'
import { TextDocument, CodeLens, CancellationToken } from 'vscode'

export class ShebangCodeLensProvider implements vscode.CodeLensProvider {
    private settings;
    
    // reload codeLenses on every configuration change.
    onDidChangeCodeLenses: vscode.Event<void> = vscode.workspace.onDidChangeConfiguration;

    public provideCodeLenses(document: TextDocument, token: CancellationToken): Thenable<CodeLens[]> {
        this.settings = vscode.workspace.getConfiguration('python');
        const codeLenses = this.createShebangCodeLens(document);

        return Promise.resolve(codeLenses);
    }

    private createShebangCodeLens(document: TextDocument) {
        const shebang = ShebangCodeLensProvider.detectShebang(document)
        if (!shebang || shebang === this.settings.get('pythonPath')) { 
            // no shebang detected or interpreter is already set to shebang
            return; 
        }

        // create CodeLens
        const firstLine = document.lineAt(0);
        const startOfShebang = new vscode.Position(0, 0);
        const endOfShebang = new vscode.Position(0, firstLine.text.length - 1);
        const shebangRange = new vscode.Range(startOfShebang, endOfShebang);
        
        const cmd : vscode.Command = { 
            command: 'python.setShebangInterpreter', 
            title: 'Set interpreter to shebang'
        }

        const codeLenses = [(new CodeLens(shebangRange, cmd))];
        return codeLenses;
    }

    public static detectShebang(document: TextDocument) {
        let error = false;
    
        let firstLine = document.lineAt(0);
        if (firstLine.isEmptyOrWhitespace) {
            error = true;
        }
    
        if (!error && "#!" === firstLine.text.substr(0, 2)) {
            // Shebang detected
            const shebang = firstLine.text.substr(2).trim();
            return shebang;
        }
    
        return null;
    }

}
