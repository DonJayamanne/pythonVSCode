import * as vscode from 'vscode';
import * as constants from '../../common/constants';

import { TestFileCodeLensProvider } from './testFiles';

export function activateCodeLenses(onDidChange: vscode.EventEmitter<void>): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.languages.registerCodeLensProvider(constants.PythonLanguage, new TestFileCodeLensProvider(onDidChange)));

    return {
        dispose: function () {
            disposables.forEach(d => d.dispose());
        }
    };
}