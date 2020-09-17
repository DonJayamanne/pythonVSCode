export const PYTHON_LANGUAGE = 'python';
export const MARKDOWN_LANGUAGE = 'markdown';
export const JUPYTER_LANGUAGE = 'jupyter';

export const PYTHON_WARNINGS = 'PYTHONWARNINGS';

export const NotebookCellScheme = 'vscode-notebook-cell';
export const PYTHON = [
    { scheme: 'file', language: PYTHON_LANGUAGE },
    { scheme: 'untitled', language: PYTHON_LANGUAGE },
    { scheme: 'vscode-notebook', language: PYTHON_LANGUAGE },
    { scheme: NotebookCellScheme, language: PYTHON_LANGUAGE }
];
export const PYTHON_ALLFILES = [{ language: PYTHON_LANGUAGE }];

export const PVSC_EXTENSION_ID = 'ms-ai-tools.jupyter';
export const AppinsightsKey = 'AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217';

export namespace Commands {
    export const SwitchOffInsidersChannel = 'jupyter.switchOffInsidersChannel';
    export const SwitchToInsidersDaily = 'jupyter.switchToDailyChannel';
    export const SwitchToInsidersWeekly = 'jupyter.switchToWeeklyChannel';
}
export namespace Octicons {
    export const Downloading = '$(cloud-download)';
    export const Installing = '$(desktop-download)';
}

export namespace Text {
    export const CodeLensRunUnitTest = 'Run Test';
    export const CodeLensDebugUnitTest = 'Debug Test';
}
export namespace Delays {
    // Max time to wait before aborting the generation of code lenses for unit tests
    export const MaxUnitTestCodeLensDelay = 5000;
}

export const DEFAULT_INTERPRETER_SETTING = 'python';

export const STANDARD_OUTPUT_CHANNEL = 'STANDARD_OUTPUT_CHANNEL';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

export function isTestExecution(): boolean {
    return process.env.VSC_JUPYTER_CI_TEST === '1' || isUnitTestExecution();
}

/**
 * Whether we're running unit tests (*.unit.test.ts).
 * These tests have a speacial meaning, they run fast.
 * @export
 * @returns {boolean}
 */
export function isUnitTestExecution(): boolean {
    return process.env.VSC_PYTHON_UNIT_TEST === '1';
}

// Temporary constant, used to indicate whether we're using custom editor api or not.
export const UseCustomEditorApi = Symbol('USE_CUSTOM_EDITOR');
export const UseVSCodeNotebookEditorApi = Symbol('USE_NATIVEEDITOR');
export const UseProposedApi = Symbol('USE_VSC_PROPOSED_API');

export * from '../constants';
