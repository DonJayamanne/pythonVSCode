
export const PythonLanguage = { language: 'python', scheme: 'file' };

export namespace Commands {
    export const Set_Interpreter = 'python.setInterpreter';
    export const Tests_View_UI = 'python.viewTests';
    export const Tests_Picker_UI = 'python.selectTestToRun';
    export const Tests_Discover = 'python.discoverTests';
    export const Tests_Run_Failed = 'python.runFailedTests';
    export const Sort_Imports = 'python.sortImports';
    export const Tests_Run = 'python.runtests';
    export const Tests_Stop = 'python.stopUnitTests';
    export const Tests_ViewOutput = 'python.viewTestOutput';
    export const Refactor_Extract_Variable = 'python.refactorExtractVariable';
    export const Refaactor_Extract_Method = 'python.refactorExtractMethod';
}
export namespace Octicons {
    export const Test_Pass = '$(check)';
    export const Test_Fail = '$(alert)';
    export const Test_Error = '$(x)';
    export const Test_Skip = '$(circle-slash)';
}

export const Button_Text_Tests_View_Output = 'View Output';

export namespace Text {
    export const CodeLensUnitTest = 'Test';
}
export namespace Delays {
    // Max time to wait before aborting the generation of code lenses for unit tests
    export const MaxUnitTestCodeLensDelay = 5000;
}