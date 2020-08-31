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

export const PVSC_EXTENSION_ID = 'ms-python.jupyter';
export const CODE_RUNNER_EXTENSION_ID = 'formulahendry.code-runner';
export const PYLANCE_EXTENSION_ID = 'ms-python.vscode-pylance';
export const AppinsightsKey = 'AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217';

export namespace Commands {
    export const SwitchOffInsidersChannel = 'jupyter.switchOffInsidersChannel';
    export const SwitchToInsidersDaily = 'jupyter.switchToDailyChannel';
    export const SwitchToInsidersWeekly = 'jupyter.switchToWeeklyChannel';
}
export namespace Octicons {
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
    export const Downloading = '$(cloud-download)';
    export const Installing = '$(desktop-download)';
}
export const DEFAULT_INTERPRETER_SETTING = 'python';

export const STANDARD_OUTPUT_CHANNEL = 'STANDARD_OUTPUT_CHANNEL';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

export function isTestExecution(): boolean {
    return process.env.VSC_PYTHON_CI_TEST === '1' || isUnitTestExecution();
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

export * from '../constants';
