
'use strict';
import { ExtensionContext, Disposable, window, StatusBarAlignment } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { InterpreterDisplay } from './display';
import { PythonInterpreterProvider } from './interpreters';
export * from './contracts';
export * from './interpreters';

const settings = PythonSettings.getInstance();
let display: InterpreterDisplay;
export function activate(): Disposable {
    const statusBar = window.createStatusBarItem(StatusBarAlignment.Left);
    const interpreterProvider = new PythonInterpreterProvider();
    display = new InterpreterDisplay(statusBar, interpreterProvider);
    settings.addListener('change', onConfigChanged);
    display.refresh();

    return {
        dispose: () => {
            statusBar.dispose();
            display.dispose();
            display = null;
        }
    }
}

function onConfigChanged() {
    if (display) {
        display.refresh();
    }
}