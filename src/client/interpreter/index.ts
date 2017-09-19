'use strict';
import { VirtualEnv } from './virtualEnvs/virtualEnv';
import { VEnv } from './virtualEnvs/venv';
import { Disposable, window, StatusBarAlignment } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { InterpreterDisplay } from './display';
import { PythonInterpreterProvider } from './sources';
import { VirtualEnvironmentManager } from './virtualEnvs/index';
export * from './sources';

const settings = PythonSettings.getInstance();
let display: InterpreterDisplay;
export function activate(): Disposable {
    const virtualEnvMgr = new VirtualEnvironmentManager([new VEnv(), new VirtualEnv()]);
    const statusBar = window.createStatusBarItem(StatusBarAlignment.Left);
    const interpreterProvider = new PythonInterpreterProvider();
    display = new InterpreterDisplay(statusBar, interpreterProvider, virtualEnvMgr);
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