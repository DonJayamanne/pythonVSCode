/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
export const PYTHON_LANGUAGE = 'python';
export const PYTHON_WARNINGS = 'PYTHONWARNINGS';

export const NotebookCellScheme = 'vscode-notebook-cell';
export const InteractiveInputScheme = 'vscode-interactive-input';
export const InteractiveScheme = 'vscode-interactive';
export const PYTHON = [
    { scheme: 'file', language: PYTHON_LANGUAGE },
    { scheme: 'untitled', language: PYTHON_LANGUAGE },
    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
    { scheme: InteractiveInputScheme, language: PYTHON_LANGUAGE },
];

export const PYTHON_NOTEBOOKS = [
    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE },
    { scheme: InteractiveInputScheme, language: PYTHON_LANGUAGE },
];

export const PVSC_EXTENSION_ID = 'donjayamanne.python-environment-manager';
export const CODE_RUNNER_EXTENSION_ID = 'formulahendry.code-runner';
export const PYLANCE_EXTENSION_ID = 'ms-python.vscode-pylance';
export const JUPYTER_EXTENSION_ID = 'ms-toolsai.jupyter';
export const AppinsightsKey = '_';

export type Channel = 'stable' | 'insiders';

export enum CommandSource {
    ui = 'ui',
    commandPalette = 'commandpalette',
}

export namespace Commands {
    export const Exec_In_Terminal = 'python.envManager.execInTerminal';
    export const Exec_In_Terminal_Icon = 'python.envManager.execInTerminal-icon';
    export const ViewOutput = 'python.envManager.viewOutput';
    export const Start_REPL = 'python.envManagerstartREPL';
    export const Create_Terminal = 'python.envManager.createTerminal';
    export const ClearStorage = 'python.envManager.clearPersistentStorage';
}

// Look at https://microsoft.github.io/vscode-codicons/dist/codicon.html for other Octicon icon ids
export namespace Octicons {
    export const Add = '$(add)';
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
    export const Downloading = '$(cloud-download)';
    export const Installing = '$(desktop-download)';
    export const Search_Stop = '$(search-stop)';
    export const Star = '$(star-full)';
    export const Gear = '$(gear)';
}

export const DEFAULT_INTERPRETER_SETTING = 'python';

export const STANDARD_OUTPUT_CHANNEL = 'STANDARD_OUTPUT_CHANNEL';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

export function isTestExecution(): boolean {
    return process.env.VSC_PYTHON_CI_TEST === '1' || isUnitTestExecution();
}

/**
 * Whether we're running unit tests (*.unit.test.ts).
 * These tests have a special meaning, they run fast.
 * @export
 * @returns {boolean}
 */
export function isUnitTestExecution(): boolean {
    return process.env.VSC_PYTHON_UNIT_TEST === '1';
}

export const UseProposedApi = Symbol('USE_VSC_PROPOSED_API');

export * from '../constants';
