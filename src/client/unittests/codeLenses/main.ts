import * as vscode from 'vscode';
import * as constants from '../../common/constants';

import { TestFileCodeLensProvider } from './testFiles';
import { PythonSymbolProvider } from '../../providers/symbolProvider';

export function activateCodeLenses(onDidChange: vscode.EventEmitter<void>, symboldProvider: PythonSymbolProvider): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.languages.registerCodeLensProvider(constants.PythonLanguage, new TestFileCodeLensProvider(onDidChange, symboldProvider)));

    return {
        dispose: function () {
            disposables.forEach(d => d.dispose());
        }
    };
}