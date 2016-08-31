import * as vscode from 'vscode';
import * as constants from '../../common/constants';

import {TestFileCodeLensProvider} from './testFiles';

export function activateCodeLenses(): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    disposables.push(vscode.languages.registerCodeLensProvider(constants.PythonLanguage, new TestFileCodeLensProvider()));

    return {
        dispose: function () {
            disposables.forEach(d => d.dispose());
        }
    }
}