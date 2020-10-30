// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import * as path from 'path';
import { EXTENSION_ROOT_DIR, JVSC_EXTENSION_ID, PYTHON_LANGUAGE } from '../common/constants';
import { IS_WINDOWS } from '../common/platform/constants';
import { IVariableQuery } from '../common/types';

export const DefaultTheme = 'Default Light+';
// Identifier for the output panel that will display the output from the Jupyter Server.
export const JUPYTER_OUTPUT_CHANNEL = 'JUPYTER_OUTPUT_CHANNEL';

// Python Module to be used when instantiating the Python Daemon.
export const JupyterDaemonModule = 'vscode_datascience_helpers.jupyter_daemon';
export const KernelLauncherDaemonModule = 'vscode_datascience_helpers.kernel_launcher_daemon';

export const PythonExtension = 'ms-python.python';

// List of 'language' names that we know about. All should be lower case as that's how we compare.
export const KnownNotebookLanguages: string[] = [
    'python',
    'r',
    'julia',
    'c++',
    'c#',
    'f#',
    'scala',
    'haskell',
    'bash',
    'cling',
    'sas'
];

export namespace Commands {
    export const RunAllCells = 'jupyter.runallcells';
    export const RunAllCellsAbove = 'jupyter.runallcellsabove';
    export const RunCellAndAllBelow = 'jupyter.runcellandallbelow';
    export const SetJupyterKernel = 'jupyter.setKernel';
    export const SwitchJupyterKernel = 'jupyter.switchKernel';
    export const RunAllCellsAbovePalette = 'jupyter.runallcellsabove.palette';
    export const RunCellAndAllBelowPalette = 'jupyter.runcurrentcellandallbelow.palette';
    export const RunToLine = 'jupyter.runtoline';
    export const RunFromLine = 'jupyter.runfromline';
    export const RunCell = 'jupyter.runcell';
    export const RunCurrentCell = 'jupyter.runcurrentcell';
    export const RunCurrentCellAdvance = 'jupyter.runcurrentcelladvance';
    export const CreateNewInteractive = 'jupyter.createnewinteractive';
    export const ImportNotebook = 'jupyter.importnotebook';
    export const ImportNotebookFile = 'jupyter.importnotebookfile';
    export const OpenNotebook = 'jupyter.opennotebook';
    export const OpenNotebookInPreviewEditor = 'jupyter.opennotebookInPreviewEditor';
    export const SelectJupyterURI = 'jupyter.selectjupyteruri';
    export const SelectJupyterCommandLine = 'jupyter.selectjupytercommandline';
    export const ExportFileAsNotebook = 'jupyter.exportfileasnotebook';
    export const ExportFileAndOutputAsNotebook = 'jupyter.exportfileandoutputasnotebook';
    export const UndoCells = 'jupyter.undocells';
    export const RedoCells = 'jupyter.redocells';
    export const RemoveAllCells = 'jupyter.removeallcells';
    export const InterruptKernel = 'jupyter.interruptkernel';
    export const RestartKernel = 'jupyter.restartkernel';
    export const NotebookEditorUndoCells = 'jupyter.notebookeditor.undocells';
    export const NotebookEditorRedoCells = 'jupyter.notebookeditor.redocells';
    export const NotebookEditorRemoveAllCells = 'jupyter.notebookeditor.removeallcells';
    export const NotebookEditorInterruptKernel = 'jupyter.notebookeditor.interruptkernel';
    export const NotebookEditorRestartKernel = 'jupyter.notebookeditor.restartkernel';
    export const NotebookEditorRunAllCells = 'jupyter.notebookeditor.runallcells';
    export const NotebookEditorRunSelectedCell = 'jupyter.notebookeditor.runselectedcell';
    export const NotebookEditorAddCellBelow = 'jupyter.notebookeditor.addcellbelow';
    export const ExpandAllCells = 'jupyter.expandallcells';
    export const CollapseAllCells = 'jupyter.collapseallcells';
    export const ExportOutputAsNotebook = 'jupyter.exportoutputasnotebook';
    export const ExecSelectionInInteractiveWindow = 'jupyter.execSelectionInteractive';
    export const RunFileInInteractiveWindows = 'jupyter.runFileInteractive';
    export const DebugFileInInteractiveWindows = 'jupyter.debugFileInteractive';
    export const AddCellBelow = 'jupyter.addcellbelow';
    export const DebugCurrentCellPalette = 'jupyter.debugcurrentcell.palette';
    export const DebugCell = 'jupyter.debugcell';
    export const DebugStepOver = 'jupyter.debugstepover';
    export const DebugContinue = 'jupyter.debugcontinue';
    export const DebugStop = 'jupyter.debugstop';
    export const RunCurrentCellAndAddBelow = 'jupyter.runcurrentcellandaddbelow';
    export const InsertCellBelowPosition = 'jupyter.insertCellBelowPosition';
    export const InsertCellBelow = 'jupyter.insertCellBelow';
    export const InsertCellAbove = 'jupyter.insertCellAbove';
    export const DeleteCells = 'jupyter.deleteCells';
    export const SelectCell = 'jupyter.selectCell';
    export const SelectCellContents = 'jupyter.selectCellContents';
    export const ExtendSelectionByCellAbove = 'jupyter.extendSelectionByCellAbove';
    export const ExtendSelectionByCellBelow = 'jupyter.extendSelectionByCellBelow';
    export const MoveCellsUp = 'jupyter.moveCellsUp';
    export const MoveCellsDown = 'jupyter.moveCellsDown';
    export const ChangeCellToMarkdown = 'jupyter.changeCellToMarkdown';
    export const ChangeCellToCode = 'jupyter.changeCellToCode';
    export const GotoNextCellInFile = 'jupyter.gotoNextCellInFile';
    export const GotoPrevCellInFile = 'jupyter.gotoPrevCellInFile';
    export const ScrollToCell = 'jupyter.scrolltocell';
    export const CreateNewNotebook = 'jupyter.createnewnotebook';
    export const ViewJupyterOutput = 'jupyter.viewOutput';
    export const ExportAsPythonScript = 'jupyter.exportAsPythonScript';
    export const ExportToHTML = 'jupyter.exportToHTML';
    export const ExportToPDF = 'jupyter.exportToPDF';
    export const Export = 'jupyter.export';
    export const SaveNotebookNonCustomEditor = 'jupyter.notebookeditor.save';
    export const SaveAsNotebookNonCustomEditor = 'jupyter.notebookeditor.saveAs';
    export const OpenNotebookNonCustomEditor = 'jupyter.notebookeditor.open';
    export const LatestExtension = 'jupyter.latestExtension';
    export const TrustNotebook = 'jupyter.notebookeditor.trust';
    export const EnableLoadingWidgetsFrom3rdPartySource = 'jupyter.enableLoadingWidgetScriptsFromThirdPartySource';
    export const NotebookEditorExpandAllCells = 'jupyter.notebookeditor.expandallcells';
    export const NotebookEditorCollapseAllCells = 'jupyter.notebookeditor.collapseallcells';
    export const EnableDebugLogging = 'jupyter.enableDebugLogging';
    export const ResetLoggingLevel = 'jupyter.resetLoggingLevel';
    export const CreateGitHubIssue = 'jupyter.createGitHubIssue';
    export const SubmitGitHubIssue = 'jupyter.submitGitHubIssue';
    export const ShowDataViewer = 'jupyter.showDataViewer';
    export const ClearSavedJupyterUris = 'jupyter.clearSavedJupyterUris';
}

export namespace CodeLensCommands {
    // If not specified in the options this is the default set of commands in our design time code lenses
    export const DefaultDesignLenses = [Commands.RunCurrentCell, Commands.RunAllCellsAbove, Commands.DebugCell];
    // If not specified in the options this is the default set of commands in our debug time code lenses
    export const DefaultDebuggingLenses = [Commands.DebugContinue, Commands.DebugStop, Commands.DebugStepOver];
    // These are the commands that are allowed at debug time
    export const DebuggerCommands = [Commands.DebugContinue, Commands.DebugStop, Commands.DebugStepOver];
}

export namespace EditorContexts {
    export const HasCodeCells = 'jupyter.hascodecells';
    export const HaveInteractiveCells = 'jupyter.haveinteractivecells';
    export const HaveRedoableCells = 'jupyter.haveredoablecells';
    export const HaveInteractive = 'jupyter.haveinteractive';
    export const IsInteractiveActive = 'jupyter.isinteractiveactive';
    export const OwnsSelection = 'jupyter.ownsSelection';
    export const HaveNativeCells = 'jupyter.havenativecells';
    export const HaveNativeRedoableCells = 'jupyter.havenativeredoablecells';
    export const HaveNative = 'jupyter.havenative';
    export const IsNativeActive = 'jupyter.isnativeactive';
    export const IsInteractiveOrNativeActive = 'jupyter.isinteractiveornativeactive';
    export const IsPythonOrNativeActive = 'jupyter.ispythonornativeactive';
    export const IsPythonOrInteractiveActive = 'jupyter.ispythonorinteractiveeactive';
    export const IsPythonOrInteractiveOrNativeActive = 'jupyter.ispythonorinteractiveornativeeactive';
    export const HaveCellSelected = 'jupyter.havecellselected';
    export const IsNotebookTrusted = 'jupyter.isnotebooktrusted';
    export const CanRestartNotebookKernel = 'jupyter.notebookeditor.canrestartNotebookkernel';
}

export namespace RegExpValues {
    export const PythonCellMarker = /^(#\s*%%|#\s*\<codecell\>|#\s*In\[\d*?\]|#\s*In\[ \])/;
    export const PythonMarkdownCellMarker = /^(#\s*%%\s*\[markdown\]|#\s*\<markdowncell\>)/;
    export const CheckJupyterRegEx = IS_WINDOWS ? /^jupyter?\.exe$/ : /^jupyter?$/;
    export const PyKernelOutputRegEx = /.*\s+(.+)$/m;
    export const KernelSpecOutputRegEx = /^\s*(\S+)\s+(\S+)$/;
    // This next one has to be a string because uglifyJS isn't handling the groups. We use named-js-regexp to parse it
    // instead.
    export const UrlPatternRegEx =
        '(?<PREFIX>https?:\\/\\/)((\\(.+\\s+or\\s+(?<IP>.+)\\))|(?<LOCAL>[^\\s]+))(?<REST>:.+)';
    export interface IUrlPatternGroupType {
        LOCAL: string | undefined;
        PREFIX: string | undefined;
        REST: string | undefined;
        IP: string | undefined;
    }
    export const HttpPattern = /https?:\/\//;
    export const ExtractPortRegex = /https?:\/\/[^\s]+:(\d+)[^\s]+/;
    export const ConvertToRemoteUri = /(https?:\/\/)([^\s])+(:\d+[^\s]*)/;
    export const ParamsExractorRegEx = /\S+\((.*)\)\s*{/;
    export const ArgsSplitterRegEx = /([^\s,]+)/;
    export const ShapeSplitterRegEx = /.*,\s*(\d+).*/;
    export const SvgHeightRegex = /(\<svg.*height=\")(.*?)\"/;
    export const SvgWidthRegex = /(\<svg.*width=\")(.*?)\"/;
    export const SvgSizeTagRegex = /\<svg.*tag=\"sizeTag=\{(.*),\s*(.*)\}\"/;
    export const StyleTagRegex = /\<style[\s\S]*\<\/style\>/m;
}

export enum Telemetry {
    ImportNotebook = 'DATASCIENCE.IMPORT_NOTEBOOK',
    RunCell = 'DATASCIENCE.RUN_CELL',
    RunCurrentCell = 'DATASCIENCE.RUN_CURRENT_CELL',
    RunCurrentCellAndAdvance = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADVANCE',
    RunAllCells = 'DATASCIENCE.RUN_ALL_CELLS',
    RunAllCellsAbove = 'DATASCIENCE.RUN_ALL_CELLS_ABOVE',
    RunCellAndAllBelow = 'DATASCIENCE.RUN_CELL_AND_ALL_BELOW',
    AddEmptyCellToBottom = 'DATASCIENCE.RUN_ADD_EMPTY_CELL_TO_BOTTOM',
    RunCurrentCellAndAddBelow = 'DATASCIENCE.RUN_CURRENT_CELL_AND_ADD_BELOW',
    InsertCellBelowPosition = 'DATASCIENCE.RUN_INSERT_CELL_BELOW_POSITION',
    InsertCellBelow = 'DATASCIENCE.RUN_INSERT_CELL_BELOW',
    InsertCellAbove = 'DATASCIENCE.RUN_INSERT_CELL_ABOVE',
    DeleteCells = 'DATASCIENCE.RUN_DELETE_CELLS',
    SelectCell = 'DATASCIENCE.RUN_SELECT_CELL',
    SelectCellContents = 'DATASCIENCE.RUN_SELECT_CELL_CONTENTS',
    ExtendSelectionByCellAbove = 'DATASCIENCE.RUN_EXTEND_SELECTION_BY_CELL_ABOVE',
    ExtendSelectionByCellBelow = 'DATASCIENCE.RUN_EXTEND_SELECTION_BY_CELL_BELOW',
    MoveCellsUp = 'DATASCIENCE.RUN_MOVE_CELLS_UP',
    MoveCellsDown = 'DATASCIENCE.RUN_MOVE_CELLS_DOWN',
    ChangeCellToMarkdown = 'DATASCIENCE.RUN_CHANGE_CELL_TO_MARKDOWN',
    ChangeCellToCode = 'DATASCIENCE.RUN_CHANGE_CELL_TO_CODE',
    GotoNextCellInFile = 'DATASCIENCE.GOTO_NEXT_CELL_IN_FILE',
    GotoPrevCellInFile = 'DATASCIENCE.GOTO_PREV_CELL_IN_FILE',
    RunSelectionOrLine = 'DATASCIENCE.RUN_SELECTION_OR_LINE',
    RunToLine = 'DATASCIENCE.RUN_TO_LINE',
    RunFromLine = 'DATASCIENCE.RUN_FROM_LINE',
    DeleteAllCells = 'DATASCIENCE.DELETE_ALL_CELLS',
    DeleteCell = 'DATASCIENCE.DELETE_CELL',
    GotoSourceCode = 'DATASCIENCE.GOTO_SOURCE',
    CopySourceCode = 'DATASCIENCE.COPY_SOURCE',
    RestartKernel = 'DS_INTERNAL.RESTART_KERNEL',
    RestartKernelCommand = 'DATASCIENCE.RESTART_KERNEL_COMMAND',
    ExportNotebookInteractive = 'DATASCIENCE.EXPORT_NOTEBOOK',
    Undo = 'DATASCIENCE.UNDO',
    Redo = 'DATASCIENCE.REDO',
    /**
     * Saving a notebook
     */
    Save = 'DATASCIENCE.SAVE',
    CellCount = 'DS_INTERNAL.CELL_COUNT',
    /**
     * Whether auto save feature in VS Code is enabled or not.
     */
    CreateNewInteractive = 'DATASCIENCE.CREATE_NEW_INTERACTIVE',
    ExpandAll = 'DATASCIENCE.EXPAND_ALL',
    CollapseAll = 'DATASCIENCE.COLLAPSE_ALL',
    SelectJupyterURI = 'DATASCIENCE.SELECT_JUPYTER_URI',
    SelectLocalJupyterKernel = 'DATASCIENCE.SELECT_LOCAL_JUPYTER_KERNEL',
    SelectRemoteJupyterKernel = 'DATASCIENCE.SELECT_REMOTE_JUPYTER_KERNEL',
    SetJupyterURIToLocal = 'DATASCIENCE.SET_JUPYTER_URI_LOCAL',
    SetJupyterURIToUserSpecified = 'DATASCIENCE.SET_JUPYTER_URI_USER_SPECIFIED',
    Interrupt = 'DATASCIENCE.INTERRUPT',
    /**
     * Exporting from the interactive window
     */
    ExportPythonFileInteractive = 'DATASCIENCE.EXPORT_PYTHON_FILE',
    ExportPythonFileAndOutputInteractive = 'DATASCIENCE.EXPORT_PYTHON_FILE_AND_OUTPUT',
    /**
     * User clicked export as quick pick button
     */
    ClickedExportNotebookAsQuickPick = 'DATASCIENCE.CLICKED_EXPORT_NOTEBOOK_AS_QUICK_PICK',
    /**
     * exported a notebook
     */
    ExportNotebookAs = 'DATASCIENCE.EXPORT_NOTEBOOK_AS',
    /**
     * User invokes export as format from command pallet
     */
    ExportNotebookAsCommand = 'DATASCIENCE.EXPORT_NOTEBOOK_AS_COMMAND',
    /**
     * An export to a specific format failed
     */
    ExportNotebookAsFailed = 'DATASCIENCE.EXPORT_NOTEBOOK_AS_FAILED',

    StartJupyter = 'DS_INTERNAL.JUPYTERSTARTUPCOST',
    SubmitCellThroughInput = 'DATASCIENCE.SUBMITCELLFROMREPL',
    ConnectLocalJupyter = 'DS_INTERNAL.CONNECTLOCALJUPYTER',
    ConnectRemoteJupyter = 'DS_INTERNAL.CONNECTREMOTEJUPYTER',
    ConnectRemoteJupyterViaLocalHost = 'DS_INTERNAL.CONNECTREMOTEJUPYTER_VIA_LOCALHOST',
    ConnectFailedJupyter = 'DS_INTERNAL.CONNECTFAILEDJUPYTER',
    ConnectRemoteFailedJupyter = 'DS_INTERNAL.CONNECTREMOTEFAILEDJUPYTER',
    StartSessionFailedJupyter = 'DS_INTERNAL.START_SESSION_FAILED_JUPYTER',
    ConnectRemoteSelfCertFailedJupyter = 'DS_INTERNAL.CONNECTREMOTESELFCERTFAILEDJUPYTER',
    RegisterAndUseInterpreterAsKernel = 'DS_INTERNAL.REGISTER_AND_USE_INTERPRETER_AS_KERNEL',
    UseInterpreterAsKernel = 'DS_INTERNAL.USE_INTERPRETER_AS_KERNEL',
    UseExistingKernel = 'DS_INTERNAL.USE_EXISTING_KERNEL',
    SwitchToInterpreterAsKernel = 'DS_INTERNAL.SWITCH_TO_INTERPRETER_AS_KERNEL',
    SwitchToExistingKernel = 'DS_INTERNAL.SWITCH_TO_EXISTING_KERNEL',
    SelfCertsMessageEnabled = 'DATASCIENCE.SELFCERTSMESSAGEENABLED',
    SelfCertsMessageClose = 'DATASCIENCE.SELFCERTSMESSAGECLOSE',
    RemoteAddCode = 'DATASCIENCE.LIVESHARE.ADDCODE',
    RemoteReexecuteCode = 'DATASCIENCE.LIVESHARE.REEXECUTECODE',
    ShiftEnterBannerShown = 'DS_INTERNAL.SHIFTENTER_BANNER_SHOWN',
    EnableInteractiveShiftEnter = 'DATASCIENCE.ENABLE_INTERACTIVE_SHIFT_ENTER',
    DisableInteractiveShiftEnter = 'DATASCIENCE.DISABLE_INTERACTIVE_SHIFT_ENTER',
    ShowDataViewer = 'DATASCIENCE.SHOW_DATA_EXPLORER',
    RunFileInteractive = 'DATASCIENCE.RUN_FILE_INTERACTIVE',
    DebugFileInteractive = 'DATASCIENCE.DEBUG_FILE_INTERACTIVE',
    PandasNotInstalled = 'DS_INTERNAL.SHOW_DATA_NO_PANDAS',
    PandasTooOld = 'DS_INTERNAL.SHOW_DATA_PANDAS_TOO_OLD',
    DataScienceSettings = 'DS_INTERNAL.SETTINGS',
    VariableExplorerToggled = 'DATASCIENCE.VARIABLE_EXPLORER_TOGGLE',
    VariableExplorerVariableCount = 'DS_INTERNAL.VARIABLE_EXPLORER_VARIABLE_COUNT',
    AddCellBelow = 'DATASCIENCE.ADD_CELL_BELOW',
    GetPasswordAttempt = 'DATASCIENCE.GET_PASSWORD_ATTEMPT',
    GetPasswordFailure = 'DS_INTERNAL.GET_PASSWORD_FAILURE',
    GetPasswordSuccess = 'DS_INTERNAL.GET_PASSWORD_SUCCESS',
    OpenPlotViewer = 'DATASCIENCE.OPEN_PLOT_VIEWER',
    DebugCurrentCell = 'DATASCIENCE.DEBUG_CURRENT_CELL',
    CodeLensAverageAcquisitionTime = 'DS_INTERNAL.CODE_LENS_ACQ_TIME',
    FindJupyterCommand = 'DS_INTERNAL.FIND_JUPYTER_COMMAND',
    /**
     * Telemetry sent when user selects an interpreter to be used for starting of Jupyter server.
     */
    SelectJupyterInterpreter = 'DS_INTERNAL.SELECT_JUPYTER_INTERPRETER',
    /**
     * User used command to select an intrepreter for the jupyter server.
     */
    SelectJupyterInterpreterCommand = 'DATASCIENCE.SELECT_JUPYTER_INTERPRETER_Command',
    StartJupyterProcess = 'DS_INTERNAL.START_JUPYTER_PROCESS',
    WaitForIdleJupyter = 'DS_INTERNAL.WAIT_FOR_IDLE_JUPYTER',
    HiddenCellTime = 'DS_INTERNAL.HIDDEN_EXECUTION_TIME',
    RestartJupyterTime = 'DS_INTERNAL.RESTART_JUPYTER_TIME',
    InterruptJupyterTime = 'DS_INTERNAL.INTERRUPT_JUPYTER_TIME',
    ExecuteCell = 'DATASCIENCE.EXECUTE_CELL_TIME',
    ExecuteCellPerceivedCold = 'DS_INTERNAL.EXECUTE_CELL_PERCEIVED_COLD',
    ExecuteCellPerceivedWarm = 'DS_INTERNAL.EXECUTE_CELL_PERCEIVED_WARM',
    PerceivedJupyterStartupNotebook = 'DS_INTERNAL.PERCEIVED_JUPYTER_STARTUP_NOTEBOOK',
    StartExecuteNotebookCellPerceivedCold = 'DS_INTERNAL.START_EXECUTE_NOTEBOOK_CELL_PERCEIVED_COLD',
    WebviewStartup = 'DS_INTERNAL.WEBVIEW_STARTUP',
    VariableExplorerFetchTime = 'DS_INTERNAL.VARIABLE_EXPLORER_FETCH_TIME',
    WebviewStyleUpdate = 'DS_INTERNAL.WEBVIEW_STYLE_UPDATE',
    WebviewMonacoStyleUpdate = 'DS_INTERNAL.WEBVIEW_MONACO_STYLE_UPDATE',
    FindJupyterKernelSpec = 'DS_INTERNAL.FIND_JUPYTER_KERNEL_SPEC',
    HashedCellOutputMimeType = 'DS_INTERNAL.HASHED_OUTPUT_MIME_TYPE',
    HashedCellOutputMimeTypePerf = 'DS_INTERNAL.HASHED_OUTPUT_MIME_TYPE_PERF',
    HashedNotebookCellOutputMimeTypePerf = 'DS_INTERNAL.HASHED_NOTEBOOK_OUTPUT_MIME_TYPE_PERF',
    JupyterInstalledButNotKernelSpecModule = 'DS_INTERNAL.JUPYTER_INTALLED_BUT_NO_KERNELSPEC_MODULE',
    DebugpyPromptToInstall = 'DATASCIENCE.DEBUGPY_PROMPT_TO_INSTALL',
    DebugpySuccessfullyInstalled = 'DATASCIENCE.DEBUGPY_SUCCESSFULLY_INSTALLED',
    DebugpyInstallFailed = 'DATASCIENCE.DEBUGPY_INSTALL_FAILED',
    DebugpyInstallCancelled = 'DATASCIENCE.DEBUGPY_INSTALL_CANCELLED',
    ScrolledToCell = 'DATASCIENCE.SCROLLED_TO_CELL',
    ExecuteNativeCell = 'DATASCIENCE.NATIVE.EXECUTE_NATIVE_CELL',
    CreateNewNotebook = 'DATASCIENCE.NATIVE.CREATE_NEW_NOTEBOOK',
    DebugStepOver = 'DATASCIENCE.DEBUG_STEP_OVER',
    DebugContinue = 'DATASCIENCE.DEBUG_CONTINUE',
    DebugStop = 'DATASCIENCE.DEBUG_STOP',
    OpenNotebook = 'DATASCIENCE.NATIVE.OPEN_NOTEBOOK',
    OpenNotebookAll = 'DATASCIENCE.NATIVE.OPEN_NOTEBOOK_ALL',
    ConvertToPythonFile = 'DATASCIENCE.NATIVE.CONVERT_NOTEBOOK_TO_PYTHON',
    NotebookWorkspaceCount = 'DS_INTERNAL.NATIVE.WORKSPACE_NOTEBOOK_COUNT',
    NotebookRunCount = 'DS_INTERNAL.NATIVE.NOTEBOOK_RUN_COUNT',
    NotebookOpenCount = 'DS_INTERNAL.NATIVE.NOTEBOOK_OPEN_COUNT',
    NotebookOpenTime = 'DS_INTERNAL.NATIVE.NOTEBOOK_OPEN_TIME',
    SessionIdleTimeout = 'DS_INTERNAL.JUPYTER_IDLE_TIMEOUT',
    JupyterStartTimeout = 'DS_INTERNAL.JUPYTER_START_TIMEOUT',
    JupyterNotInstalledErrorShown = 'DATASCIENCE.JUPYTER_NOT_INSTALLED_ERROR_SHOWN',
    JupyterCommandSearch = 'DATASCIENCE.JUPYTER_COMMAND_SEARCH',
    RegisterInterpreterAsKernel = 'DS_INTERNAL.JUPYTER_REGISTER_INTERPRETER_AS_KERNEL',
    UserInstalledJupyter = 'DATASCIENCE.USER_INSTALLED_JUPYTER',
    UserInstalledPandas = 'DATASCIENCE.USER_INSTALLED_PANDAS',
    UserDidNotInstallJupyter = 'DATASCIENCE.USER_DID_NOT_INSTALL_JUPYTER',
    UserDidNotInstallPandas = 'DATASCIENCE.USER_DID_NOT_INSTALL_PANDAS',
    OpenedInteractiveWindow = 'DATASCIENCE.OPENED_INTERACTIVE',
    OpenNotebookFailure = 'DS_INTERNAL.NATIVE.OPEN_NOTEBOOK_FAILURE',
    FindKernelForLocalConnection = 'DS_INTERNAL.FIND_KERNEL_FOR_LOCAL_CONNECTION',
    CompletionTimeFromLS = 'DS_INTERNAL.COMPLETION_TIME_FROM_LS',
    CompletionTimeFromJupyter = 'DS_INTERNAL.COMPLETION_TIME_FROM_JUPYTER',
    NotebookLanguage = 'DATASCIENCE.NOTEBOOK_LANGUAGE',
    KernelSpecNotFound = 'DS_INTERNAL.KERNEL_SPEC_NOT_FOUND',
    KernelRegisterFailed = 'DS_INTERNAL.KERNEL_REGISTER_FAILED',
    KernelEnumeration = 'DS_INTERNAL.KERNEL_ENUMERATION',
    KernelLauncherPerf = 'DS_INTERNAL.KERNEL_LAUNCHER_PERF',
    KernelProviderPerf = 'DS_INTERNAL.KERNEL_PROVIDER_PERF',
    GetPreferredKernelPerf = 'DS_INTERNAL.GET_PREFERRED_KERNEL_PERF',
    KernelFinderPerf = 'DS_INTERNAL.KERNEL_FINDER_PERF',
    JupyterInstallFailed = 'DS_INTERNAL.JUPYTER_INSTALL_FAILED',
    UserInstalledModule = 'DATASCIENCE.USER_INSTALLED_MODULE',
    JupyterCommandLineNonDefault = 'DS_INTERNAL.JUPYTER_CUSTOM_COMMAND_LINE',
    NewFileForInteractiveWindow = 'DS_INTERNAL.NEW_FILE_USED_IN_INTERACTIVE',
    KernelInvalid = 'DS_INTERNAL.INVALID_KERNEL_USED',
    ZMQSupported = 'DS_INTERNAL.ZMQ_NATIVE_BINARIES_LOADING',
    ZMQNotSupported = 'DS_INTERNAL.ZMQ_NATIVE_BINARIES_NOT_LOADING',
    IPyWidgetLoadSuccess = 'DS_INTERNAL.IPYWIDGET_LOAD_SUCCESS',
    IPyWidgetLoadFailure = 'DS_INTERNAL.IPYWIDGET_LOAD_FAILURE',
    IPyWidgetWidgetVersionNotSupportedLoadFailure = 'DS_INTERNAL.IPYWIDGET_WIDGET_VERSION_NOT_SUPPORTED_LOAD_FAILURE',
    IPyWidgetLoadDisabled = 'DS_INTERNAL.IPYWIDGET_LOAD_DISABLED',
    HashedIPyWidgetNameUsed = 'DS_INTERNAL.IPYWIDGET_USED_BY_USER',
    VSCNotebookCellTranslationFailed = 'DS_INTERNAL.VSCNOTEBOOK_CELL_TRANSLATION_FAILED',
    HashedIPyWidgetNameDiscovered = 'DS_INTERNAL.IPYWIDGET_DISCOVERED',
    HashedIPyWidgetScriptDiscoveryError = 'DS_INTERNAL.IPYWIDGET_DISCOVERY_ERRORED',
    DiscoverIPyWidgetNamesLocalPerf = 'DS_INTERNAL.IPYWIDGET_TEST_AVAILABILITY_ON_LOCAL',
    DiscoverIPyWidgetNamesCDNPerf = 'DS_INTERNAL.IPYWIDGET_TEST_AVAILABILITY_ON_CDN',
    IPyWidgetPromptToUseCDN = 'DS_INTERNAL.IPYWIDGET_PROMPT_TO_USE_CDN',
    IPyWidgetPromptToUseCDNSelection = 'DS_INTERNAL.IPYWIDGET_PROMPT_TO_USE_CDN_SELECTION',
    IPyWidgetOverhead = 'DS_INTERNAL.IPYWIDGET_OVERHEAD',
    IPyWidgetRenderFailure = 'DS_INTERNAL.IPYWIDGET_RENDER_FAILURE',
    IPyWidgetUnhandledMessage = 'DS_INTERNAL.IPYWIDGET_UNHANDLED_MESSAGE',
    RawKernelCreatingNotebook = 'DS_INTERNAL.RAWKERNEL_CREATING_NOTEBOOK',
    JupyterCreatingNotebook = 'DS_INTERNAL.JUPYTER_CREATING_NOTEBOOK',
    RawKernelSessionConnect = 'DS_INTERNAL.RAWKERNEL_SESSION_CONNECT',
    RawKernelStartRawSession = 'DS_INTERNAL.RAWKERNEL_START_RAW_SESSION',
    RawKernelSessionStartSuccess = 'DS_INTERNAL.RAWKERNEL_SESSION_START_SUCCESS',
    RawKernelSessionStartUserCancel = 'DS_INTERNAL.RAWKERNEL_SESSION_START_USER_CANCEL',
    RawKernelSessionStartTimeout = 'DS_INTERNAL.RAWKERNEL_SESSION_START_TIMEOUT',
    RawKernelSessionStartException = 'DS_INTERNAL.RAWKERNEL_SESSION_START_EXCEPTION',
    RawKernelProcessLaunch = 'DS_INTERNAL.RAWKERNEL_PROCESS_LAUNCH',
    RunByLineStart = 'DATASCIENCE.RUN_BY_LINE',
    RunByLineStep = 'DATASCIENCE.RUN_BY_LINE_STEP',
    RunByLineStop = 'DATASCIENCE.RUN_BY_LINE_STOP',
    RunByLineVariableHover = 'DATASCIENCE.RUN_BY_LINE_VARIABLE_HOVER',
    TrustAllNotebooks = 'DATASCIENCE.TRUST_ALL_NOTEBOOKS',
    TrustNotebook = 'DATASCIENCE.TRUST_NOTEBOOK',
    DoNotTrustNotebook = 'DATASCIENCE.DO_NOT_TRUST_NOTEBOOK',
    NotebookTrustPromptShown = 'DATASCIENCE.NOTEBOOK_TRUST_PROMPT_SHOWN'
}

export enum NativeKeyboardCommandTelemetry {
    ArrowDown = 'DATASCIENCE.NATIVE.KEYBOARD.ARROW_DOWN',
    ArrowUp = 'DATASCIENCE.NATIVE.KEYBOARD.ARROW_UP',
    ChangeToCode = 'DATASCIENCE.NATIVE.KEYBOARD.CHANGE_TO_CODE',
    ChangeToMarkdown = 'DATASCIENCE.NATIVE.KEYBOARD.CHANGE_TO_MARKDOWN',
    DeleteCell = 'DATASCIENCE.NATIVE.KEYBOARD.DELETE_CELL',
    InsertAbove = 'DATASCIENCE.NATIVE.KEYBOARD.INSERT_ABOVE',
    InsertBelow = 'DATASCIENCE.NATIVE.KEYBOARD.INSERT_BELOW',
    Redo = 'DATASCIENCE.NATIVE.KEYBOARD.REDO',
    Run = 'DATASCIENCE.NATIVE.KEYBOARD.RUN',
    Save = 'DATASCIENCE.NATIVE.KEYBOARD.SAVE',
    RunAndAdd = 'DATASCIENCE.NATIVE.KEYBOARD.RUN_AND_ADD',
    RunAndMove = 'DATASCIENCE.NATIVE.KEYBOARD.RUN_AND_MOVE',
    ToggleLineNumbers = 'DATASCIENCE.NATIVE.KEYBOARD.TOGGLE_LINE_NUMBERS',
    ToggleOutput = 'DATASCIENCE.NATIVE.KEYBOARD.TOGGLE_OUTPUT',
    Undo = 'DATASCIENCE.NATIVE.KEYBOARD.UNDO',
    Unfocus = 'DATASCIENCE.NATIVE.KEYBOARD.UNFOCUS'
}

export enum NativeMouseCommandTelemetry {
    AddToEnd = 'DATASCIENCE.NATIVE.MOUSE.ADD_TO_END',
    ChangeToCode = 'DATASCIENCE.NATIVE.MOUSE.CHANGE_TO_CODE',
    ChangeToMarkdown = 'DATASCIENCE.NATIVE.MOUSE.CHANGE_TO_MARKDOWN',
    DeleteCell = 'DATASCIENCE.NATIVE.MOUSE.DELETE_CELL',
    InsertBelow = 'DATASCIENCE.NATIVE.MOUSE.INSERT_BELOW',
    MoveCellDown = 'DATASCIENCE.NATIVE.MOUSE.MOVE_CELL_DOWN',
    MoveCellUp = 'DATASCIENCE.NATIVE.MOUSE.MOVE_CELL_UP',
    Run = 'DATASCIENCE.NATIVE.MOUSE.RUN',
    RunAbove = 'DATASCIENCE.NATIVE.MOUSE.RUN_ABOVE',
    RunAll = 'DATASCIENCE.NATIVE.MOUSE.RUN_ALL',
    RunBelow = 'DATASCIENCE.NATIVE.MOUSE.RUN_BELOW',
    SelectKernel = 'DATASCIENCE.NATIVE.MOUSE.SELECT_KERNEL',
    SelectServer = 'DATASCIENCE.NATIVE.MOUSE.SELECT_SERVER',
    Save = 'DATASCIENCE.NATIVE.MOUSE.SAVE',
    ToggleVariableExplorer = 'DATASCIENCE.NATIVE.MOUSE.TOGGLE_VARIABLE_EXPLORER'
}

/**
 * Notebook editing in VS Code Notebooks is handled by VSC.
 * There's no way for us to know whether user added a cell using keyboard or not.
 * Similarly a cell could have been added as part of an undo operation.
 * All we know is previously user had n # of cells and now they have m # of cells.
 */
export enum VSCodeNativeTelemetry {
    AddCell = 'DATASCIENCE.VSCODE_NATIVE.INSERT_CELL',
    RunAllCells = 'DATASCIENCE.VSCODE_NATIVE.RUN_ALL',
    DeleteCell = 'DATASCIENCE.VSCODE_NATIVE.DELETE_CELL',
    MoveCell = 'DATASCIENCE.VSCODE_NATIVE.MOVE_CELL',
    ChangeToCode = 'DATASCIENCE.VSCODE_NATIVE.CHANGE_TO_CODE', // Not guaranteed to work see, https://github.com/microsoft/vscode/issues/100042
    ChangeToMarkdown = 'DATASCIENCE.VSCODE_NATIVE.CHANGE_TO_MARKDOWN' // Not guaranteed to work see, https://github.com/microsoft/vscode/issues/100042
}

export namespace HelpLinks {
    export const PythonInteractiveHelpLink = 'https://aka.ms/pyaiinstall';
    export const JupyterDataRateHelpLink = 'https://aka.ms/AA5ggm0'; // This redirects here: https://jupyter-notebook.readthedocs.io/en/stable/config.html
}

export namespace Settings {
    export const JupyterServerLocalLaunch = 'local';
    export const JupyterServerRemoteLaunch = 'remote';
    export const JupyterServerUriList = 'jupyter.jupyterServer.uriList';
    export const JupyterServerRemoteLaunchUriListKey = 'remote-uri-list';
    export const JupyterServerRemoteLaunchUriSeparator = '\r';
    export const JupyterServerRemoteLaunchNameSeparator = '\n';
    export const JupyterServerRemoteLaunchUriEqualsDisplayName = 'same';
    export const JupyterServerRemoteLaunchService = JVSC_EXTENSION_ID;
    export const JupyterServerUriListMax = 10;
    // If this timeout expires, ignore the completion request sent to Jupyter.
    export const IntellisenseTimeout = 500;
    // If this timeout expires, ignore the completions requests. (don't wait for it to complete).
    export const MaxIntellisenseTimeout = 30_000;
    export const RemoteDebuggerPortBegin = 8889;
    export const RemoteDebuggerPortEnd = 9000;
    export const DefaultVariableQuery: IVariableQuery = {
        language: PYTHON_LANGUAGE,
        query: '_rwho_ls = %who_ls\nprint(_rwho_ls)',
        parseExpr: "'(\\w+)'"
    };
}

export namespace DataFrameLoading {
    export const SysPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'vscode_datascience_helpers', 'dataframes');
    export const DataFrameSysImport = `import sys\nsys.path.append("${SysPath.replace(/\\/g, '\\\\')}")`;
    export const DataFrameInfoImportName = '_VSCODE_InfoImport';
    export const DataFrameInfoImport = `import vscodeGetDataFrameInfo as ${DataFrameInfoImportName}`;
    export const DataFrameInfoFunc = `${DataFrameInfoImportName}._VSCODE_getDataFrameInfo`;
    export const DataFrameRowImportName = '_VSCODE_RowImport';
    export const DataFrameRowImport = `import vscodeGetDataFrameRows as ${DataFrameRowImportName}`;
    export const DataFrameRowFunc = `${DataFrameRowImportName}._VSCODE_getDataFrameRows`;
    export const VariableInfoImportName = '_VSCODE_VariableImport';
    export const VariableInfoImport = `import vscodeGetVariableInfo as ${VariableInfoImportName}`;
    export const VariableInfoFunc = `${VariableInfoImportName}._VSCODE_getVariableInfo`;
}

export namespace Identifiers {
    export const EmptyFileName = '2DB9B899-6519-4E1B-88B0-FA728A274115';
    export const GeneratedThemeName = 'ipython-theme'; // This needs to be all lower class and a valid class name.
    export const HistoryPurpose = 'history';
    export const RawPurpose = 'raw';
    export const PingPurpose = 'ping';
    export const MatplotLibDefaultParams = '_VSCode_defaultMatplotlib_Params';
    export const EditCellId = '3D3AB152-ADC1-4501-B813-4B83B49B0C10';
    export const SvgSizeTag = 'sizeTag={{0}, {1}}';
    export const InteractiveWindowIdentityScheme = 'history';
    export const DefaultCodeCellMarker = '# %%';
    export const DefaultCommTarget = 'jupyter.widget';
    export const ALL_VARIABLES = 'ALL_VARIABLES';
    export const OLD_VARIABLES = 'OLD_VARIABLES';
    export const KERNEL_VARIABLES = 'KERNEL_VARIABLES';
    export const DEBUGGER_VARIABLES = 'DEBUGGER_VARIABLES';
    export const MULTIPLEXING_DEBUGSERVICE = 'MULTIPLEXING_DEBUGSERVICE';
    export const RUN_BY_LINE_DEBUGSERVICE = 'RUN_BY_LINE_DEBUGSERVICE';
    export const REMOTE_URI = 'https://remote/';
    export const REMOTE_URI_ID_PARAM = 'id';
    export const REMOTE_URI_HANDLE_PARAM = 'uriHandle';
}

export namespace CodeSnippets {
    export const ChangeDirectory = [
        '{0}',
        '{1}',
        'import os',
        'try:',
        "\tos.chdir(os.path.join(os.getcwd(), '{2}'))",
        '\tprint(os.getcwd())',
        'except:',
        '\tpass',
        ''
    ];
    export const ChangeDirectoryCommentIdentifier = '# ms-toolsai.jupyter added'; // Not translated so can compare.
    export const ImportIPython = '{0}\nfrom IPython import get_ipython\n\n{1}';
    export const MatplotLibInitSvg = `import matplotlib\n%matplotlib inline\n${Identifiers.MatplotLibDefaultParams} = dict(matplotlib.rcParams)\n%config InlineBackend.figure_formats = {'svg', 'png'}`;
    export const MatplotLibInitPng = `import matplotlib\n%matplotlib inline\n${Identifiers.MatplotLibDefaultParams} = dict(matplotlib.rcParams)\n%config InlineBackend.figure_formats = {'png'}`;
    export const ConfigSvg = `%config InlineBackend.figure_formats = {'svg', 'png'}`;
    export const ConfigPng = `%config InlineBackend.figure_formats = {'png'}`;
    export const UpdateCWDAndPath =
        'import os\nimport sys\n%cd "{0}"\nif os.getcwd() not in sys.path:\n    sys.path.insert(0, os.getcwd())';
    export const disableJedi = '%config Completer.use_jedi = False';
}

export enum JupyterCommands {
    NotebookCommand = 'notebook',
    ConvertCommand = 'nbconvert',
    KernelSpecCommand = 'kernelspec'
}

export namespace LiveShare {
    export const JupyterExecutionService = 'jupyterExecutionService';
    export const JupyterServerSharedService = 'jupyterServerSharedService';
    export const JupyterNotebookSharedService = 'jupyterNotebookSharedService';
    export const CommandBrokerService = 'commmandBrokerService';
    export const WebPanelMessageService = 'webPanelMessageService';
    export const InteractiveWindowProviderService = 'interactiveWindowProviderService';
    export const GuestCheckerService = 'guestCheckerService';
    export const LiveShareBroadcastRequest = 'broadcastRequest';
    export const RawNotebookProviderService = 'rawNotebookProviderSharedService';
    export const ResponseLifetime = 15000;
    export const ResponseRange = 1000; // Range of time alloted to check if a response matches or not
    export const InterruptDefaultTimeout = 10000;
}

export namespace LiveShareCommands {
    export const isNotebookSupported = 'isNotebookSupported';
    export const connectToNotebookServer = 'connectToNotebookServer';
    export const getUsableJupyterPython = 'getUsableJupyterPython';
    export const executeObservable = 'executeObservable';
    export const getSysInfo = 'getSysInfo';
    export const requestKernelInfo = 'requestKernelInfo';
    export const serverResponse = 'serverResponse';
    export const catchupRequest = 'catchupRequest';
    export const syncRequest = 'synchRequest';
    export const restart = 'restart';
    export const interrupt = 'interrupt';
    export const interactiveWindowCreate = 'interactiveWindowCreate';
    export const interactiveWindowCreateSync = 'interactiveWindowCreateSync';
    export const disposeServer = 'disposeServer';
    export const guestCheck = 'guestCheck';
    export const createNotebook = 'createNotebook';
    export const inspect = 'inspect';
    export const rawKernelSupported = 'rawKernelSupported';
    export const createRawNotebook = 'createRawNotebook';
}

export const VSCodeNotebookProvider = 'VSCodeNotebookProvider';
export const OurNotebookProvider = 'OurNotebookProvider';
export const DataScienceStartupTime = Symbol('DataScienceStartupTime');
