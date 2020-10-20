// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../constants';

// External callers of localize use these tables to retrieve localized values.

export namespace Common {
    export const bannerLabelYes = localize('Common.bannerLabelYes', 'Yes');
    export const bannerLabelNo = localize('Common.bannerLabelNo', 'No');
    export const yesPlease = localize('Common.yesPlease', 'Yes, please');
    export const canceled = localize('Common.canceled', 'Canceled');
    export const cancel = localize('Common.cancel', 'Cancel');
    export const ok = localize('Common.ok', 'Ok');
    export const gotIt = localize('Common.gotIt', 'Got it!');
    export const install = localize('Common.install', 'Install');
    export const loadingExtension = localize('Common.loadingExtension', 'Jupyter extension loading...');
    export const openOutputPanel = localize('Common.openOutputPanel', 'Show output');
    export const noIWillDoItLater = localize('Common.noIWillDoItLater', 'No, I will do it later');
    export const notNow = localize('Common.notNow', 'Not now');
    export const doNotShowAgain = localize('Common.doNotShowAgain', 'Do not show again');
    export const reload = localize('Common.reload', 'Reload');
    export const moreInfo = localize('Common.moreInfo', 'More Info');
    export const learnMore = localize('Common.learnMore', 'Learn more');
    export const and = localize('Common.and', 'and');
    export const reportThisIssue = localize('Common.reportThisIssue', 'Report this issue');
}

export namespace CommonSurvey {
    export const remindMeLaterLabel = localize('CommonSurvey.remindMeLaterLabel', 'Remind me later');
    export const yesLabel = localize('CommonSurvey.yesLabel', 'Yes, take survey now');
    export const noLabel = localize('CommonSurvey.noLabel', 'No, thanks');
}

export namespace Http {
    export const downloadingFile = localize('downloading.file', 'Downloading {0}...');
    export const downloadingFileProgress = localize('downloading.file.progress', '{0}{1} of {2} KB ({3}%)');
}
export namespace Experiments {
    export const inGroup = localize('Experiments.inGroup', "User belongs to experiment group '{0}'");
}
export namespace ExtensionChannels {
    export const yesWeekly = localize('ExtensionChannels.yesWeekly', 'Yes, weekly');
    export const yesDaily = localize('ExtensionChannels.yesDaily', 'Yes, daily');
    export const promptMessage = localize(
        'ExtensionChannels.promptMessage',
        'We noticed you are using Visual Studio Code Insiders. Would you like to use the Insiders build of the Jupyter extension?'
    );
    export const reloadToUseInsidersMessage = localize(
        'ExtensionChannels.reloadToUseInsidersMessage',
        'Please reload Visual Studio Code to use the insiders build of the Jupyter extension.'
    );
    export const downloadCompletedOutputMessage = localize(
        'ExtensionChannels.downloadCompletedOutputMessage',
        'Insiders build download complete.'
    );
    export const startingDownloadOutputMessage = localize(
        'ExtensionChannels.startingDownloadOutputMessage',
        'Starting download for Insiders build.'
    );
    export const downloadingInsidersMessage = localize(
        'ExtensionChannels.downloadingInsidersMessage',
        'Downloading Insiders Extension... '
    );
    export const installingInsidersMessage = localize(
        'ExtensionChannels.installingInsidersMessage',
        'Installing Insiders build of extension... '
    );
    export const installingStableMessage = localize(
        'ExtensionChannels.installingStableMessage',
        'Installing Stable build of extension... '
    );
    export const installationCompleteMessage = localize('ExtensionChannels.installationCompleteMessage', 'complete.');
}
export namespace OutputChannelNames {
    export const jupyter = localize('OutputChannelNames.jupyter', 'Jupyter');
}

export namespace GitHubIssue {
    export const failure = localize(
        'GitHubIssue.Failure',
        'We encountered an error while submitting your GitHub issue. Would you still like to report an issue?'
    );
    export const copyContentToClipboardAndOpenIssue = localize(
        'GitHubIssue.copyToClipboardAndOpenIssue',
        'Yes, copy content to clipboard and open issue'
    );
    export const askForIssueTitle = localize(
        'GitHubIssue.askForIssueTitle',
        'Please provide a descriptive title summarizing your issue.'
    );
    export const titlePlaceholder = localize(
        'GitHubIssue.titlePlaceholder',
        'E.g.: Unable to start a local kernel session'
    );
    export const pleaseFillThisOut = localize(
        'GitHubIssue.pleaseFillThisOut',
        'Please fill this section out and delete this comment before submitting an issue!'
    );
    export const missingFields = localize(
        'GitHubIssue.missingFields',
        'Please provide details of the issue you encountered before clicking Submit GitHub Issue.'
    );
    export const submitGitHubIssue = localize('GitHubIssue.submitGitHubIssue', '✅ Submit GitHub Issue');
}

export namespace Logging {
    export const currentWorkingDirectory = localize('Logging.CurrentWorkingDirectory', 'cwd:');
    export const warnUserAboutDebugLoggingSetting = localize(
        'Logging.WarnUserAboutDebugLoggingSetting',
        'You have enabled debug logging for the Jupyter extension, which will continue to write logs to disk. Would you like to turn debug logging off?.'
    );
    export const bannerYesTurnOffDebugLogging = localize(
        'Logging.YesTurnOffDebugLogging',
        'Yes, turn off debug logging'
    );
}

export namespace InteractiveShiftEnterBanner {
    export const bannerMessage = localize(
        'InteractiveShiftEnterBanner.bannerMessage',
        'Would you like shift-enter to send code to the new Interactive Window experience?'
    );
}

export namespace DataScienceSurveyBanner {
    export const bannerMessage = localize(
        'DataScienceSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?'
    );
    export const bannerLabelYes = localize('DataScienceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('DataScienceSurveyBanner.bannerLabelNo', 'No, thanks');
}
export namespace DataScienceRendererExtension {
    export const installingExtension = localize(
        'DataScienceRendererExtension.installingExtension',
        'Installing Notebook Renderers extension... '
    );
    export const installationCompleteMessage = localize(
        'DataScienceRendererExtension.installationCompleteMessage',
        'complete.'
    );
    export const startingDownloadOutputMessage = localize(
        'DataScienceRendererExtension.startingDownloadOutputMessage',
        'Starting download of Notebook Renderers extension.'
    );
    export const downloadingMessage = localize(
        'DataScienceRendererExtension.downloadingMessage',
        'Downloading Notebook Renderers Extension... '
    );
    export const downloadCompletedOutputMessage = localize(
        'DataScienceRendererExtension.downloadCompletedOutputMessage',
        'Notebook Renderers extension download complete.'
    );
}
export namespace DataScienceNotebookSurveyBanner {
    export const bannerMessage = localize(
        'DataScienceNotebookSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Preview Notebook Editor is working for you?'
    );
}

export namespace ExtensionSurveyBanner {
    export const bannerMessage = localize(
        'ExtensionSurveyBanner.bannerMessage',
        'Can you please take 2 minutes to tell us how the Python extension is working for you?'
    );
    export const bannerLabelYes = localize('ExtensionSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    export const bannerLabelNo = localize('ExtensionSurveyBanner.bannerLabelNo', 'No, thanks');
    export const maybeLater = localize('ExtensionSurveyBanner.maybeLater', 'Maybe later');
}

export namespace DataScience {
    export const pythonExtensionRequired = localize(
        'DataScience.pythonExtensionRequired',
        'The Python extension is required to perform that task. Click Yes to open Python extension installation page.'
    );

    export const pythonExtensionRecommended = localize(
        'DataScience.pythonExtensionRecommended',
        'You have opened a Python notebook. Would you like to install the Python extension?'
    );

    export const pythonInstalledReloadPromptMessage = localize(
        'DataScience.pythonInstalledReloadPromptMessage',
        'Python extension is now installed. Reload window to activate?'
    );
    export const unknownServerUri = localize(
        'DataScience.unknownServerUri',
        'Server URI cannot be used. Did you uninstall an extension that provided a Jupyter server connection?'
    );
    export const uriProviderDescriptionFormat = localize(
        'DataScience.uriProviderDescriptionFormat',
        '{0} (From {1} extension)'
    );
    export const unknownPackage = localize('DataScience.unknownPackage', 'unknown');
    export const interactiveWindowTitle = localize('DataScience.interactiveWindowTitle', 'Interactive');
    export const interactiveWindowTitleFormat = localize(
        'DataScience.interactiveWindowTitleFormat',
        'Interactive - {0}'
    );

    export const interactiveWindowModeBannerTitle = localize(
        'DataScience.interactiveWindowModeBannerTitle',
        'Do you want to open a new Interactive window for this file? [More Information](command:workbench.action.openSettings?%5B%22jupyter.interactiveWindowMode%22%5D).'
    );

    export const interactiveWindowModeBannerSwitchYes = localize(
        'DataScience.interactiveWindowModeBannerSwitchYes',
        'Yes'
    );
    export const interactiveWindowModeBannerSwitchAlways = localize(
        'DataScience.interactiveWindowModeBannerSwitchAlways',
        'Always'
    );
    export const interactiveWindowModeBannerSwitchNo = localize(
        'DataScience.interactiveWindowModeBannerSwitchNo',
        'No'
    );

    export const dataExplorerTitle = localize('DataScience.dataExplorerTitle', 'Data Viewer');
    export const badWebPanelFormatString = localize(
        'DataScience.badWebPanelFormatString',
        '<html><body><h1>{0} is not a valid file name</h1></body></html>'
    );
    export const checkingIfImportIsSupported = localize(
        'DataScience.checkingIfImportIsSupported',
        'Checking if import is supported'
    );
    export const installingMissingDependencies = localize(
        'DataScience.installingMissingDependencies',
        'Installing missing dependencies'
    );
    export const performingExport = localize('DataScience.performingExport', 'Performing Export');
    export const convertingToPDF = localize('DataScience.convertingToPDF', 'Converting to PDF');
    export const exportNotebookToPython = localize(
        'DataScience.exportNotebookToPython',
        'Exporting Notebook to Python'
    );
    export const sessionDisposed = localize(
        'DataScience.sessionDisposed',
        'Cannot execute code, session has been disposed.'
    );
    export const passwordFailure = localize(
        'DataScience.passwordFailure',
        'Failed to connect to password protected server. Check that password is correct.'
    );
    export const rawKernelProcessNotStarted = localize(
        'DataScience.rawKernelProcessNotStarted',
        'Raw kernel process was not able to start.'
    );
    export const rawKernelProcessExitBeforeConnect = localize(
        'DataScience.rawKernelProcessExitBeforeConnect',
        'Raw kernel process exited before connecting.'
    );
    export const unknownMimeTypeFormat = localize(
        'DataScience.unknownMimeTypeFormat',
        'Mime type {0} is not currently supported'
    );
    export const exportDialogTitle = localize('DataScience.exportDialogTitle', 'Export to Jupyter Notebook');
    export const exportDialogFilter = localize('DataScience.exportDialogFilter', 'Jupyter Notebooks');
    export const exportDialogComplete = localize('DataScience.exportDialogComplete', 'Notebook written to {0}');
    export const exportDialogFailed = localize('DataScience.exportDialogFailed', 'Failed to export notebook. {0}');
    export const exportOpenQuestion = localize('DataScience.exportOpenQuestion', 'Open in browser');
    export const exportOpenQuestion1 = localize('DataScience.exportOpenQuestion1', 'Open in editor');
    export const runCellLensCommandTitle = localize('jupyter.command.jupyter.runcell.title', 'Run cell');
    export const importDialogTitle = localize('DataScience.importDialogTitle', 'Import Jupyter Notebook');
    export const importDialogFilter = localize('DataScience.importDialogFilter', 'Jupyter Notebooks');
    export const notebookCheckForImportTitle = localize(
        'DataScience.notebookCheckForImportTitle',
        'Do you want to import the Jupyter Notebook into Python code?'
    );
    export const notebookCheckForImportYes = localize('DataScience.notebookCheckForImportYes', 'Import');
    export const notebookCheckForImportNo = localize('DataScience.notebookCheckForImportNo', 'Later');
    export const notebookCheckForImportDontAskAgain = localize(
        'DataScience.notebookCheckForImportDontAskAgain',
        "Don't Ask Again"
    );
    export const libraryNotInstalled = localize(
        'DataScience.libraryNotInstalled',
        'Data Science library {0} is not installed. Install?'
    );
    export const couldNotInstallLibrary = localize(
        'DataScience.couldNotInstallLibrary',
        'Could not install {0}. If pip is not available, please use the package manager of your choice to manually install this library into your Python environment.'
    );
    export const libraryRequiredToLaunchJupyterNotInstalled = localize(
        'DataScience.libraryRequiredToLaunchJupyterNotInstalled',
        'Data Science library {0} is not installed.'
    );
    export const librariesRequiredToLaunchJupyterNotInstalled = localize(
        'DataScience.librariesRequiredToLaunchJupyterNotInstalled',
        'Data Science libraries {0} are not installed.'
    );
    export const libraryRequiredToLaunchJupyterNotInstalledInterpreter = localize(
        'DataScience.libraryRequiredToLaunchJupyterNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const libraryRequiredToLaunchJupyterKernelNotInstalledInterpreter = localize(
        'DataScience.libraryRequiredToLaunchJupyterKernelNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const librariesRequiredToLaunchJupyterNotInstalledInterpreter = localize(
        'DataScience.librariesRequiredToLaunchJupyterNotInstalledInterpreter',
        '{0} requires {1} to be installed.'
    );
    export const selectJupyterInterpreter = localize(
        'DataScience.selectJupyterInterpreter',
        'Select an Interpreter to start Jupyter'
    );
    export const jupyterInstall = localize('DataScience.jupyterInstall', 'Install');
    export const currentlySelectedJupyterInterpreterForPlaceholder = localize(
        'Datascience.currentlySelectedJupyterInterpreterForPlaceholder',
        'current: {0}'
    );
    export const jupyterNotSupported = localize(
        'DataScience.jupyterNotSupported',
        'Jupyter cannot be started. Error attempting to locate jupyter: {0}'
    );
    export const jupyterNotSupportedBecauseOfEnvironment = localize(
        'DataScience.jupyterNotSupportedBecauseOfEnvironment',
        'Activating {0} to run Jupyter failed with {1}'
    );
    export const jupyterNbConvertNotSupported = localize(
        'DataScience.jupyterNbConvertNotSupported',
        'Jupyter nbconvert is not installed'
    );
    export const jupyterLaunchTimedOut = localize(
        'DataScience.jupyterLaunchTimedOut',
        'The Jupyter notebook server failed to launch in time'
    );
    export const jupyterLaunchNoURL = localize(
        'DataScience.jupyterLaunchNoURL',
        'Failed to find the URL of the launched Jupyter notebook server'
    );
    export const jupyterSelfCertFail = localize(
        'DataScience.jupyterSelfCertFail',
        'The security certificate used by server {0} was not issued by a trusted certificate authority.\r\nThis may indicate an attempt to steal your information.\r\nDo you want to enable the Allow Unauthorized Remote Connection setting for this workspace to allow you to connect?'
    );
    export const jupyterSelfCertEnable = localize('DataScience.jupyterSelfCertEnable', 'Yes, connect anyways');
    export const jupyterSelfCertClose = localize('DataScience.jupyterSelfCertClose', 'No, close the connection');
    export const pythonInteractiveHelpLink = localize(
        'DataScience.pythonInteractiveHelpLink',
        'See [https://aka.ms/pyaiinstall] for help on installing jupyter.'
    );
    export const markdownHelpInstallingMissingDependencies = localize(
        'DataScience.markdownHelpInstallingMissingDependencies',
        'See [https://aka.ms/pyaiinstall](https://aka.ms/pyaiinstall) for help on installing Jupyter and related dependencies.'
    );
    export const importingFormat = localize('DataScience.importingFormat', 'Importing {0}');
    export const startingJupyter = localize('DataScience.startingJupyter', 'Starting Jupyter server');
    export const connectingIPyKernel = localize('DataScience.connectingToIPyKernel', 'Connecting to Jupyter kernel');
    export const connectedToIPyKernel = localize('DataScience.connectedToIPyKernel', 'Connected.');
    export const connectingToJupyter = localize('DataScience.connectingToJupyter', 'Connecting to Jupyter server');
    export const exportingFormat = localize('DataScience.exportingFormat', 'Exporting {0}');
    export const runAllCellsLensCommandTitle = localize('jupyter.command.jupyter.runallcells.title', 'Run all cells');
    export const runAllCellsAboveLensCommandTitle = localize(
        'jupyter.command.jupyter.runallcellsabove.title',
        'Run above'
    );
    export const runCellAndAllBelowLensCommandTitle = localize(
        'jupyter.command.jupyter.runcellandallbelow.title',
        'Run Below'
    );
    export const importChangeDirectoryComment = localize(
        'DataScience.importChangeDirectoryComment',
        '{0} Change working directory from the workspace root to the ipynb file location. Turn this addition off with the DataScience.changeDirOnImportExport setting'
    );
    export const exportChangeDirectoryComment = localize(
        'DataScience.exportChangeDirectoryComment',
        '# Change directory to VSCode workspace root so that relative path loads work correctly. Turn this addition off with the DataScience.changeDirOnImportExport setting'
    );

    export const restartKernelMessage = localize(
        'DataScience.restartKernelMessage',
        'Do you want to restart the Jupter kernel? All variables will be lost.'
    );
    export const restartKernelMessageYes = localize('DataScience.restartKernelMessageYes', 'Restart');
    export const restartKernelMessageDontAskAgain = localize(
        'DataScience.restartKernelMessageDontAskAgain',
        "Don't Ask Again"
    );
    export const restartKernelMessageNo = localize('DataScience.restartKernelMessageNo', 'Cancel');
    export const restartingKernelStatus = localize('DataScience.restartingKernelStatus', 'Restarting Jupyter Kernel');
    export const restartingKernelFailed = localize(
        'DataScience.restartingKernelFailed',
        'Kernel restart failed. Jupyter server is hung. Please reload VS code.'
    );
    export const interruptingKernelFailed = localize(
        'DataScience.interruptingKernelFailed',
        'Kernel interrupt failed. Jupyter server is hung. Please reload VS code.'
    );
    export const sessionStartFailedWithKernel = localize(
        'DataScience.sessionStartFailedWithKernel',
        "Failed to start a session for the Kernel '{0}'. \nView Jupyter [log](command:{1}) for further details."
    );
    export const executingCode = localize('DataScience.executingCode', 'Executing Cell');
    export const collapseAll = localize('DataScience.collapseAll', 'Collapse all cell inputs');
    export const expandAll = localize('DataScience.expandAll', 'Expand all cell inputs');
    export const collapseSingle = localize('DataScience.collapseSingle', 'Collapse');
    export const expandSingle = localize('DataScience.expandSingle', 'Expand');
    export const exportKey = localize('DataScience.export', 'Export as Jupyter notebook');
    export const restartServer = localize('DataScience.restartServer', 'Restart Jupyter Kernel');
    export const undo = localize('DataScience.undo', 'Undo');
    export const redo = localize('DataScience.redo', 'Redo');
    export const save = localize('DataScience.save', 'Save file');
    export const clearAll = localize('DataScience.clearAll', 'Remove all cells');
    export const reloadRequired = localize(
        'DataScience.reloadRequired',
        'Please reload the window for new settings to take effect.'
    );
    export const pythonVersionHeader = localize('DataScience.pythonVersionHeader', 'Python Version:');
    export const pythonRestartHeader = localize('DataScience.pythonRestartHeader', 'Restarted Kernel:');
    export const pythonNewHeader = localize('DataScience.pythonNewHeader', 'Started new kernel:');
    export const pythonConnectHeader = localize('DataScience.pythonConnectHeader', 'Connected to kernel:');

    export const jupyterSelectURIPrompt = localize(
        'DataScience.jupyterSelectURIPrompt',
        'Enter the URI of the running Jupyter server'
    );
    export const jupyterSelectURIQuickPickTitle = localize(
        'DataScience.jupyterSelectURIQuickPickTitle',
        'Pick how to connect to Jupyter'
    );
    export const jupyterSelectURIQuickPickPlaceholder = localize(
        'DataScience.jupyterSelectURIQuickPickPlaceholder',
        'Choose an option'
    );
    export const jupyterSelectURILocalLabel = localize('DataScience.jupyterSelectURILocalLabel', 'Default');
    export const jupyterSelectURILocalDetail = localize(
        'DataScience.jupyterSelectURILocalDetail',
        'VS Code will automatically start a server for you on the localhost'
    );
    export const jupyterSelectURIMRUDetail = localize('DataScience.jupyterSelectURIMRUDetail', 'Last Connection: {0}');
    export const jupyterSelectURINewLabel = localize('DataScience.jupyterSelectURINewLabel', 'Existing');
    export const jupyterSelectURINewDetail = localize(
        'DataScience.jupyterSelectURINewDetail',
        'Specify the URI of an existing server'
    );
    export const jupyterSelectURIInvalidURI = localize(
        'DataScience.jupyterSelectURIInvalidURI',
        'Invalid URI specified'
    );
    export const jupyterSelectURIRunningDetailFormat = localize(
        'DataScience.jupyterSelectURIRunningDetailFormat',
        'Last activity {0}. {1} existing connections.'
    );
    export const jupyterSelectURINotRunningDetail = localize(
        'DataScience.jupyterSelectURINotRunningDetail',
        'Cannot connect at this time. Status unknown.'
    );
    export const jupyterSelectUserAndPasswordTitle = localize(
        'DataScience.jupyterSelectUserAndPasswordTitle',
        'Enter your user name and password to connect to Jupyter Hub'
    );
    export const jupyterSelectUserPrompt = localize('DataScience.jupyterSelectUserPrompt', 'Enter your user name');
    export const jupyterSelectPasswordPrompt = localize(
        'DataScience.jupyterSelectPasswordPrompt',
        'Enter your password'
    );
    export const jupyterNotebookFailure = localize(
        'DataScience.jupyterNotebookFailure',
        'Jupyter notebook failed to launch. \r\n{0}'
    );
    export const jupyterNotebookConnectFailed = localize(
        'DataScience.jupyterNotebookConnectFailed',
        'Failed to connect to Jupyter notebook. \r\n{0}\r\n{1}'
    );
    export const reloadAfterChangingJupyterServerConnection = localize(
        'DataScience.reloadAfterChangingJupyterServerConnection',
        'Please reload VS Code when changing the Jupyter Server connection.'
    );
    export const jupyterNotebookRemoteConnectFailed = localize(
        'DataScience.jupyterNotebookRemoteConnectFailed',
        'Failed to connect to remote Jupyter notebook.\r\nCheck that the Jupyter Server URI setting has a valid running server specified.\r\n{0}\r\n{1}'
    );
    export const jupyterNotebookRemoteConnectSelfCertsFailed = localize(
        'DataScience.jupyterNotebookRemoteConnectSelfCertsFailed',
        'Failed to connect to remote Jupyter notebook.\r\nSpecified server is using self signed certs. Enable Allow Unauthorized Remote Connection setting to connect anyways\r\n{0}\r\n{1}'
    );
    export const rawConnectionDisplayName = localize(
        'DataScience.rawConnectionDisplayName',
        'Direct kernel connection'
    );
    export const rawConnectionBrokenError = localize(
        'DataScience.rawConnectionBrokenError',
        'Direct kernel connection broken'
    );
    export const jupyterServerCrashed = localize(
        'DataScience.jupyterServerCrashed',
        'Jupyter server crashed. Unable to connect. \r\nError code from jupyter: {0}'
    );
    export const notebookVersionFormat = localize('DataScience.notebookVersionFormat', 'Jupyter Notebook Version: {0}');
    export const jupyterKernelSpecNotFound = localize(
        'DataScience.jupyterKernelSpecNotFound',
        'Cannot create a Jupyter kernel spec and none are available for use'
    );
    export const jupyterKernelSpecModuleNotFound = localize(
        'DataScience.jupyterKernelSpecModuleNotFound',
        "'Kernelspec' module not installed in the selected interpreter ({0}).\n Please re-install or update 'jupyter'."
    );
    export const interruptKernel = localize('DataScience.interruptKernel', 'Interrupt Jupyter Kernel');
    export const clearAllOutput = localize('DataScience.clearAllOutput', 'Clear All Output');
    export const interruptKernelStatus = localize('DataScience.interruptKernelStatus', 'Interrupting Jupyter Kernel');
    export const exportCancel = localize('DataScience.exportCancel', 'Cancel');
    export const exportPythonQuickPickLabel = localize('DataScience.exportPythonQuickPickLabel', 'Python Script');
    export const exportHTMLQuickPickLabel = localize('DataScience.exportHTMLQuickPickLabel', 'HTML');
    export const exportPDFQuickPickLabel = localize('DataScience.exportPDFQuickPickLabel', 'PDF');
    export const restartKernelAfterInterruptMessage = localize(
        'DataScience.restartKernelAfterInterruptMessage',
        'Interrupting the kernel timed out. Do you want to restart the kernel instead? All variables will be lost.'
    );
    export const pythonInterruptFailedHeader = localize(
        'DataScience.pythonInterruptFailedHeader',
        'Keyboard interrupt crashed the kernel. Kernel restarted.'
    );
    export const sysInfoURILabel = localize('DataScience.sysInfoURILabel', 'Jupyter Server URI: ');
    export const executingCodeFailure = localize('DataScience.executingCodeFailure', 'Executing code failed : {0}');
    export const inputWatermark = localize('DataScience.inputWatermark', 'Type code here and press shift-enter to run');
    export const liveShareConnectFailure = localize(
        'DataScience.liveShareConnectFailure',
        'Cannot connect to host jupyter session. URI not found.'
    );
    export const liveShareCannotSpawnNotebooks = localize(
        'DataScience.liveShareCannotSpawnNotebooks',
        'Spawning jupyter notebooks is not supported over a live share connection'
    );
    export const liveShareCannotImportNotebooks = localize(
        'DataScience.liveShareCannotImportNotebooks',
        'Importing notebooks is not currently supported over a live share connection'
    );
    export const liveShareHostFormat = localize('DataScience.liveShareHostFormat', '{0} Jupyter Server');
    export const liveShareSyncFailure = localize(
        'DataScience.liveShareSyncFailure',
        'Synchronization failure during live share startup.'
    );
    export const liveShareServiceFailure = localize(
        'DataScience.liveShareServiceFailure',
        "Failure starting '{0}' service during live share connection."
    );
    export const documentMismatch = localize(
        'DataScience.documentMismatch',
        'Cannot run cells, duplicate documents for {0} found.'
    );
    export const jupyterGetVariablesBadResults = localize(
        'DataScience.jupyterGetVariablesBadResults',
        'Failed to fetch variable info from the Jupyter server.'
    );
    export const dataExplorerInvalidVariableFormat = localize(
        'DataScience.dataExplorerInvalidVariableFormat',
        "'{0}' is not an active variable."
    );
    export const pythonInteractiveCreateFailed = localize(
        'DataScience.pythonInteractiveCreateFailed',
        "Failure to create a 'Interactive' window. Try reinstalling the Python extension."
    );
    export const jupyterGetVariablesExecutionError = localize(
        'DataScience.jupyterGetVariablesExecutionError',
        'Failure during variable extraction: \r\n{0}'
    );
    export const loadingMessage = localize('DataScience.loadingMessage', 'loading ...');
    export const fetchingDataViewer = localize('DataScience.fetchingDataViewer', 'Fetching data ...');
    export const noRowsInDataViewer = localize('DataScience.noRowsInDataViewer', 'No rows match current filter');
    export const jupyterServer = localize('DataScience.jupyterServer', 'Jupyter Server');
    export const notebookIsTrusted = localize('DataScience.notebookIsTrusted', 'Trusted');
    export const notebookIsNotTrusted = localize('DataScience.notebookIsNotTrusted', 'Not Trusted');
    export const noKernel = localize('DataScience.noKernel', 'No Kernel');
    export const serverNotStarted = localize('DataScience.serverNotStarted', 'Not Started');
    export const selectKernel = localize('DataScience.selectKernel', 'Select a Kernel');
    export const selectDifferentKernel = localize('DataScience.selectDifferentKernel', 'Select a different Kernel');
    export const selectDifferentJupyterInterpreter = localize(
        'DataScience.selectDifferentJupyterInterpreter',
        'Select a different Interpreter'
    );
    export const localJupyterServer = localize('DataScience.localJupyterServer', 'local');
    export const pandasTooOldForViewingFormat = localize(
        'DataScience.pandasTooOldForViewingFormat',
        "Python package 'pandas' is version {0}. Version 0.20 or greater is required for viewing data."
    );
    export const pandasRequiredForViewing = localize(
        'DataScience.pandasRequiredForViewing',
        "Python package 'pandas' is required for viewing data."
    );
    export const valuesColumn = localize('DataScience.valuesColumn', 'values');
    export const liveShareInvalid = localize(
        'DataScience.liveShareInvalid',
        'One or more guests in the session do not have the Jupyter Extension installed. Live share session cannot continue.'
    );
    export const tooManyColumnsMessage = localize(
        'DataScience.tooManyColumnsMessage',
        'Variables with over a 1000 columns may take a long time to display. Are you sure you wish to continue?'
    );
    export const tooManyColumnsYes = localize('DataScience.tooManyColumnsYes', 'Yes');
    export const tooManyColumnsNo = localize('DataScience.tooManyColumnsNo', 'No');
    export const tooManyColumnsDontAskAgain = localize('DataScience.tooManyColumnsDontAskAgain', "Don't Ask Again");
    export const filterRowsButton = localize('DataScience.filterRowsButton', 'Filter Rows');
    export const filterRowsTooltip = localize(
        'DataScience.filterRowsTooltip',
        'Allows filtering multiple rows. Use =, >, or < signs to filter numeric values.'
    );
    export const previewHeader = localize('DataScience.previewHeader', '--- Begin preview of {0} ---');
    export const previewFooter = localize('DataScience.previewFooter', '--- End preview of {0} ---');
    export const previewStatusMessage = localize('DataScience.previewStatusMessage', 'Generating preview of {0}');
    export const plotViewerTitle = localize('DataScience.plotViewerTitle', 'Plots');
    export const exportPlotTitle = localize('DataScience.exportPlotTitle', 'Save plot image');
    export const pdfFilter = localize('DataScience.pdfFilter', 'PDF');
    export const pngFilter = localize('DataScience.pngFilter', 'PNG');
    export const svgFilter = localize('DataScience.svgFilter', 'SVG');
    export const previousPlot = localize('DataScience.previousPlot', 'Previous');
    export const nextPlot = localize('DataScience.nextPlot', 'Next');
    export const panPlot = localize('DataScience.panPlot', 'Pan');
    export const zoomInPlot = localize('DataScience.zoomInPlot', 'Zoom in');
    export const zoomOutPlot = localize('DataScience.zoomOutPlot', 'Zoom out');
    export const exportPlot = localize('DataScience.exportPlot', 'Export to different formats');
    export const deletePlot = localize('DataScience.deletePlot', 'Remove');
    export const editSection = localize('DataScience.editSection', 'Input new cells here.');
    export const selectedImageListLabel = localize('DataScience.selectedImageListLabel', 'Selected Image');
    export const imageListLabel = localize('DataScience.imageListLabel', 'Image');
    export const exportImageFailed = localize('DataScience.exportImageFailed', 'Error exporting image: {0}');
    export const jupyterDataRateExceeded = localize(
        'DataScience.jupyterDataRateExceeded',
        'Cannot view variable because data rate exceeded. Please restart your server with a higher data rate limit. For example, --NotebookApp.iopub_data_rate_limit=10000000000.0'
    );
    export const addCellBelowCommandTitle = localize('DataScience.addCellBelowCommandTitle', 'Add cell');
    export const debugCellCommandTitle = localize('DataScience.debugCellCommandTitle', 'Debug Cell');
    export const debugStepOverCommandTitle = localize('DataScience.debugStepOverCommandTitle', 'Step over');
    export const debugContinueCommandTitle = localize('DataScience.debugContinueCommandTitle', 'Continue');
    export const debugStopCommandTitle = localize('DataScience.debugStopCommandTitle', 'Stop');
    export const runCurrentCellAndAddBelow = localize(
        'DataScience.runCurrentCellAndAddBelow',
        'Run current and add cell below'
    );
    export const variableExplorerDisabledDuringDebugging = localize(
        'DataScience.variableExplorerDisabledDuringDebugging',
        "Please see the Debug Side Bar's VARIABLES section."
    );
    export const jupyterDebuggerNotInstalledError = localize(
        'DataScience.jupyterDebuggerNotInstalledError',
        'Pip module {0} is required for debugging cells. You will need to install it to debug cells.'
    );
    export const jupyterDebuggerOutputParseError = localize(
        'DataScience.jupyterDebuggerOutputParseError',
        'Unable to parse {0} output, please log an issue with https://github.com/microsoft/vscode-jupyter'
    );
    export const jupyterDebuggerPortNotAvailableError = localize(
        'DataScience.jupyterDebuggerPortNotAvailableError',
        'Port {0} cannot be opened for debugging. Please specify a different port in the remoteDebuggerPort setting.'
    );
    export const jupyterDebuggerPortBlockedError = localize(
        'DataScience.jupyterDebuggerPortBlockedError',
        'Port {0} cannot be connected to for debugging. Please let port {0} through your firewall.'
    );
    export const jupyterDebuggerPortNotAvailableSearchError = localize(
        'DataScience.jupyterDebuggerPortNotAvailableSearchError',
        'Ports in the range {0}-{1} cannot be found for debugging. Please specify a port in the remoteDebuggerPort setting.'
    );
    export const jupyterDebuggerPortBlockedSearchError = localize(
        'DataScience.jupyterDebuggerPortBlockedSearchError',
        'A port cannot be connected to for debugging. Please let ports {0}-{1} through your firewall.'
    );
    export const jupyterDebuggerInstallNew = localize(
        'DataScience.jupyterDebuggerInstallNew',
        'Pip module {0} is required for debugging cells. Install {0} and continue to debug cell?'
    );
    export const jupyterDebuggerInstallNewRunByLine = localize(
        'DataScience.jupyterDebuggerInstallNewRunByLine',
        'Pip module {0} is required for running by line. Install {0} and continue to run by line?'
    );
    export const jupyterDebuggerInstallUpdate = localize(
        'DataScience.jupyterDebuggerInstallUpdate',
        'The version of {0} installed does not support debugging cells. Update {0} to newest version and continue to debug cell?'
    );
    export const jupyterDebuggerInstallUpdateRunByLine = localize(
        'DataScience.jupyterDebuggerInstallUpdateRunByLine',
        'The version of {0} installed does not support running by line. Update {0} to newest version and continue to run by line?'
    );
    export const jupyterDebuggerInstallYes = localize('DataScience.jupyterDebuggerInstallYes', 'Yes');
    export const jupyterDebuggerInstallNo = localize('DataScience.jupyterDebuggerInstallNo', 'No');
    export const cellStopOnErrorFormatMessage = localize(
        'DataScience.cellStopOnErrorFormatMessage',
        '{0} cells were canceled due to an error in the previous cell.'
    );
    export const scrollToCellTitleFormatMessage = localize('DataScience.scrollToCellTitleFormatMessage', 'Go to [{0}]');
    export const instructionComments = localize(
        'DataScience.instructionComments',
        '# To add a new cell, type "{0}"\n# To add a new markdown cell, type "{0} [markdown]"\n'
    );
    export const invalidNotebookFileError = localize(
        'DataScience.invalidNotebookFileError',
        'Notebook is not in the correct format. Check the file for correct json.'
    );
    export const invalidNotebookFileErrorFormat = localize(
        'DataScience.invalidNotebookFileError',
        '{0} is not a valid notebook file. Check the file for correct json.'
    );
    export const nativeEditorTitle = localize('DataScience.nativeEditorTitle', 'Notebook Editor');
    export const untitledNotebookFileName = localize('DataScience.untitledNotebookFileName', 'Untitled');
    export const dirtyNotebookMessage1 = localize(
        'DataScience.dirtyNotebookMessage1',
        'Do you want to save the changes you made to {0}?'
    );
    export const dirtyNotebookMessage2 = localize(
        'DataScience.dirtyNotebookMessage2',
        "Your changes will be lost if you don't save them."
    );
    export const dirtyNotebookYes = localize('DataScience.dirtyNotebookYes', 'Save');
    export const dirtyNotebookNo = localize('DataScience.dirtyNotebookNo', "Don't Save");
    export const dirtyNotebookCancel = localize('DataScience.dirtyNotebookCancel', 'Cancel');
    export const dirtyNotebookDialogTitle = localize('DataScience.dirtyNotebookDialogTitle', 'Save');
    export const dirtyNotebookDialogFilter = localize('DataScience.dirtyNotebookDialogFilter', 'Jupyter Notebooks');
    export const remoteDebuggerNotSupported = localize(
        'DataScience.remoteDebuggerNotSupported',
        'Debugging while attached to a remote server is not currently supported.'
    );
    export const notebookExportAs = localize('DataScience.notebookExportAs', 'Export As');
    export const exportAsPythonFileTitle = localize('DataScience.exportAsPythonFileTitle', 'Save As Python File');
    export const exportAsQuickPickPlaceholder = localize('DataScience.exportAsQuickPickPlaceholder', 'Export As...');
    export const openExportedFileMessage = localize(
        'DataScience.openExportedFileMessage',
        'Would you like to open the exported file?'
    );
    export const openExportFileYes = localize('DataScience.openExportFileYes', 'Yes');
    export const openExportFileNo = localize('DataScience.openExportFileNo', 'No');
    export const exportFailedGeneralMessage = localize(
        'DataScience.exportFailedGeneralMessage',
        `Please check the 'Python' [output](command:python.viewOutput) panel for further details.`
    );
    export const exportToPDFDependencyMessage = localize(
        'DataScience.exportToPDFDependencyMessage',
        'If you have not installed xelatex (TeX) you will need to do so before you can export to PDF, for further instructions please look https://nbconvert.readthedocs.io/en/latest/install.html#installing-tex. \r\nTo avoid installing xelatex (TeX) you might want to try exporting to HTML and using your browsers "Print to PDF" feature.'
    );
    export const failedExportMessage = localize('DataScience.failedExportMessage', 'Export failed.');
    export const runCell = localize('DataScience.runCell', 'Run cell');
    export const deleteCell = localize('DataScience.deleteCell', 'Delete cell');
    export const moveCellUp = localize('DataScience.moveCellUp', 'Move cell up');
    export const moveCellDown = localize('DataScience.moveCellDown', 'Move cell down');
    export const moveSelectedCellUp = localize('DataScience.moveSelectedCellUp', 'Move selected cell up');
    export const moveSelectedCellDown = localize('DataScience.deleteCell', 'Move selected cell down');
    export const insertBelow = localize('DataScience.insertBelow', 'Insert cell below');
    export const insertAbove = localize('DataScience.insertAbove', 'Insert cell above');
    export const addCell = localize('DataScience.addCell', 'Add cell');
    export const runAll = localize('DataScience.runAll', 'Insert cell');
    export const convertingToPythonFile = localize(
        'DataScience.convertingToPythonFile',
        'Converting ipynb to python file'
    );
    export const noInterpreter = localize('DataScience.noInterpreter', 'No python selected');
    export const notebookNotFound = localize(
        'DataScience.notebookNotFound',
        'python -m jupyter notebook --version is not running'
    );
    export const findJupyterCommandProgress = localize(
        'DataScience.findJupyterCommandProgress',
        'Active interpreter does not support {0}. Searching for the best available interpreter.'
    );
    export const findJupyterCommandProgressCheckInterpreter = localize(
        'DataScience.findJupyterCommandProgressCheckInterpreter',
        'Checking {0}.'
    );
    export const findJupyterCommandProgressSearchCurrentPath = localize(
        'DataScience.findJupyterCommandProgressSearchCurrentPath',
        'Searching current path.'
    );
    export const gatherError = localize('DataScience.gatherError', 'Gather internal error');
    export const gatheredScriptDescription = localize(
        'DataScience.gatheredScriptDescription',
        '# This file was generated by the Gather Extension.\n# It requires version 2020.7.94776 (or newer) of the Jupyter Extension.\n#\n#     The intent is that it contains only the code required to produce\n#     the same results as the cell originally selected for gathering.\n#     Please note that the Python analysis is quite conservative, so if\n#     it is unsure whether a line of code is necessary for execution, it\n#     will err on the side of including it.\n#\n# Please let us know if you are satisfied with what was gathered here:\n# https://aka.ms/gatherfeedback\n\n'
    );
    export const gatheredScriptDescriptionWithoutSurvey = localize(
        'DataScience.gatheredScriptDescriptionWithoutSurvey',
        '# This file was generated by the Gather Extension.\n# It requires version 2020.7.94776 (or newer) of the Python Extension.\n#\n#     The intent is that it contains only the code required to produce\n#     the same results as the cell originally selected for gathering.\n#     Please note that the Python analysis is quite conservative, so if\n#     it is unsure whether a line of code is necessary for execution, it\n#     will err on the side of including it.\n'
    );
    export const gatheredNotebookDescriptionInMarkdown = localize(
        'DataScience.gatheredNotebookDescriptionInMarkdown',
        '# Gathered Notebook\nGathered from ```{0}```\n\n|   |   |\n|---|---|\n|&nbsp;&nbsp;&nbsp|This notebook was generated by the Gather Extension. It requires version 2020.7.94776 (or newer) of the Jupyter Extension, please update [here](https://command:jupyter.latestExtension). The intent is that it contains only the code and cells required to produce the same results as the cell originally selected for gathering. Please note that the Python analysis is quite conservative, so if it is unsure whether a line of code is necessary for execution, it will err on the side of including it.|\n\n**Are you satisfied with the code that was gathered?**\n\n[Yes](https://command:jupyter.gatherquality?yes) [No](https://command:jupyter.gatherquality?no)'
    );
    export const gatheredNotebookDescriptionInMarkdownWithoutSurvey = localize(
        'DataScience.gatheredNotebookDescriptionInMarkdown',
        '# Gathered Notebook\nGathered from ```{0}```\n\n|   |   |\n|---|---|\n|&nbsp;&nbsp;&nbsp|This notebook was generated by the Gather Extension. It requires version 2020.7.94776 (or newer) of the Python Extension, please update [here](https://command:python.datascience.latestExtension). The intent is that it contains only the code and cells required to produce the same results as the cell originally selected for gathering. Please note that the Python analysis is quite conservative, so if it is unsure whether a line of code is necessary for execution, it will err on the side of including it.|\n\n'
    );
    export const savePngTitle = localize('DataScience.savePngTitle', 'Save Image');
    export const fallbackToUseActiveInterpreterAsKernel = localize(
        'DataScience.fallbackToUseActiveInterpeterAsKernel',
        "Couldn't find kernel '{0}' that the notebook was created with. Using the current interpreter."
    );
    export const fallBackToRegisterAndUseActiveInterpeterAsKernel = localize(
        'DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel',
        "Couldn't find kernel '{0}' that the notebook was created with. Registering a new kernel using the current interpreter."
    );
    export const fallBackToPromptToUseActiveInterpreterOrSelectAKernel = localize(
        'DataScience.fallBackToPromptToUseActiveInterpreterOrSelectAKernel',
        "Couldn't find kernel '{0}' that the notebook was created with."
    );
    export const startingJupyterLogMessage = localize(
        'DataScience.startingJupyterLogMessage',
        'Starting Jupyter from {0}'
    );
    export const jupyterStartTimedout = localize(
        'DataScience.jupyterStartTimedout',
        "Starting Jupyter has timedout. Please check the 'Jupyter' output panel for further details."
    );
    export const switchingKernelProgress = localize('DataScience.switchingKernelProgress', "Switching Kernel to '{0}'");
    export const waitingForJupyterSessionToBeIdle = localize(
        'DataScience.waitingForJupyterSessionToBeIdle',
        'Waiting for Jupyter Session to be idle'
    );
    export const gettingListOfKernelsForLocalConnection = localize(
        'DataScience.gettingListOfKernelsForLocalConnection',
        'Fetching Kernels'
    );
    export const gettingListOfKernelsForRemoteConnection = localize(
        'DataScience.gettingListOfKernelsForRemoteConnection',
        'Fetching Kernels'
    );
    export const gettingListOfKernelSpecs = localize('DataScience.gettingListOfKernelSpecs', 'Fetching Kernel specs');
    export const startingJupyterNotebook = localize('DataScience.startingJupyterNotebook', 'Starting Jupyter Notebook');
    export const registeringKernel = localize('DataScience.registeringKernel', 'Registering Kernel');
    export const trimmedOutput = localize(
        'DataScience.trimmedOutput',
        'Output was trimmed for performance reasons.\nTo see the full output set the setting "jupyter.textOutputLimit" to 0.'
    );
    export const jupyterCommandLineDefaultLabel = localize('DataScience.jupyterCommandLineDefaultLabel', 'Default');
    export const jupyterCommandLineDefaultDetail = localize(
        'DataScience.jupyterCommandLineDefaultDetail',
        'The Python extension will determine the appropriate command line for Jupyter'
    );
    export const jupyterCommandLineCustomLabel = localize('DataScience.jupyterCommandLineCustomLabel', 'Custom');
    export const jupyterCommandLineCustomDetail = localize(
        'DataScience.jupyterCommandLineCustomDetail',
        'Customize the command line passed to Jupyter on startup'
    );
    export const jupyterCommandLineReloadQuestion = localize(
        'DataScience.jupyterCommandLineReloadQuestion',
        'Please reload the window when changing the Jupyter command line.'
    );
    export const jupyterCommandLineReloadAnswer = localize('DataScience.jupyterCommandLineReloadAnswer', 'Reload');
    export const jupyterCommandLineQuickPickPlaceholder = localize(
        'DataScience.jupyterCommandLineQuickPickPlaceholder',
        'Choose an option'
    );
    export const jupyterCommandLineQuickPickTitle = localize(
        'DataScience.jupyterCommandLineQuickPickTitle',
        'Pick command line for Jupyter'
    );
    export const jupyterCommandLinePrompt = localize(
        'DataScience.jupyterCommandLinePrompt',
        'Enter your custom command line for Jupyter'
    );

    export const connectingToJupyterUri = localize(
        'DataScience.connectingToJupyterUri',
        'Connecting to Jupyter server at {0}'
    );
    export const createdNewNotebook = localize('DataScience.createdNewNotebook', '{0}: Creating new notebook ');

    export const createdNewKernel = localize('DataScience.createdNewKernel', '{0}: Kernel started: {1}');
    export const kernelInvalid = localize(
        'DataScience.kernelInvalid',
        'Kernel {0} is not usable. Check the Jupyter output tab for more information.'
    );

    export const nativeDependencyFail = localize(
        'DataScience.nativeDependencyFail',
        '{0}. We cannot launch a jupyter server for you because your OS is not supported. Select an already running server if you wish to continue.'
    );

    export const selectNewServer = localize('DataScience.selectNewServer', 'Pick Running Server');
    export const jupyterSelectURIRemoteLabel = localize('DataScience.jupyterSelectURIRemoteLabel', 'Existing');
    export const jupyterSelectURIQuickPickTitleRemoteOnly = localize(
        'DataScience.jupyterSelectURIQuickPickTitleRemoteOnly',
        'Pick an already running jupyter server'
    );
    export const jupyterSelectURIRemoteDetail = localize(
        'DataScience.jupyterSelectURIRemoteDetail',
        'Specify the URI of an existing server'
    );

    export const loadClassFailedWithNoInternet = localize(
        'DataScience.loadClassFailedWithNoInternet',
        'Error loading {0}:{1}. Internet connection required for loading 3rd party widgets.'
    );
    export const loadThirdPartyWidgetScriptsPostEnabled = localize(
        'DataScience.loadThirdPartyWidgetScriptsPostEnabled',
        "Please restart the Kernel when changing the setting 'jupyter.widgetScriptSources'."
    );
    export const useCDNForWidgets = localize(
        'DataScience.useCDNForWidgets',
        'Widgets require us to download supporting files from a 3rd party website. Click [here](https://aka.ms/PVSCIPyWidgets) for more information.'
    );
    export const enableCDNForWidgetsSetting = localize(
        'DataScience.enableCDNForWidgetsSetting',
        "Widgets require us to download supporting files from a 3rd party website. Click <a href='https://command:jupyter.enableLoadingWidgetScriptsFromThirdPartySource'>here</a> to enable this or click <a href='https://aka.ms/PVSCIPyWidgets'>here</a> for more information. (Error loading {0}:{1})."
    );

    export const unhandledMessage = localize(
        'DataScience.unhandledMessage',
        'Unhandled kernel message from a widget: {0} : {1}'
    );

    export const widgetScriptNotFoundOnCDNWidgetMightNotWork = localize(
        'DataScience.widgetScriptNotFoundOnCDNWidgetMightNotWork',
        "Unable to load a compatible version of the widget '{0}'. Expected behavior may be affected."
    );
    export const qgridWidgetScriptVersionCompatibilityWarning = localize(
        'DataScience.qgridWidgetScriptVersionCompatibilityWarning',
        "Unable to load a compatible version of the widget 'qgrid'. Consider downgrading to version 1.1.1."
    );

    export const kernelStarted = localize('DataScience.kernelStarted', 'Started kernel {0}.');
    export const runByLine = localize('DataScience.runByLine', 'Run by line (F10)');
    export const step = localize('DataScience.step', 'Run next line (F10)');
    export const stopRunByLine = localize('DataScience.stopRunByLine', 'Stop');
    export const rawKernelSessionFailed = localize(
        'DataScience.rawKernelSessionFailed',
        'Unable to start session for kernel {0}. Select another kernel to launch with.'
    );
    export const rawKernelConnectingSession = localize(
        'DataScience.rawKernelConnectingSession',
        'Connecting to kernel.'
    );

    export const reloadCustomEditor = localize(
        'DataScience.reloadCustomEditor',
        'Please reload VS Code to use the custom editor API'
    );
    export const reloadVSCodeNotebookEditor = localize(
        'DataScience.reloadVSCodeNotebookEditor',
        'Please reload VS Code to use the Notebook Editor'
    );
    export const usingPreviewNotebookWithOtherNotebookWarning = localize(
        'DataScience.usingPreviewNotebookWithOtherNotebookWarning',
        'Opening the same file in the Preview Notebook Editor and stable Notebook Editor is not recommended. Doing so could result in data loss or corruption of notebooks.'
    );
    export const launchNotebookTrustPrompt = localize(
        'DataScience.launchNotebookTrustPrompt',
        'A notebook could execute harmful code when opened. Some outputs have been hidden. Do you trust this notebook? [Learn more.](https://aka.ms/trusted-notebooks)'
    );
    export const trustNotebook = localize('DataScience.launchNotebookTrustPrompt.yes', 'Trust');
    export const doNotTrustNotebook = localize('DataScience.launchNotebookTrustPrompt.no', 'Do not trust');
    export const trustAllNotebooks = localize(
        'DataScience.launchNotebookTrustPrompt.trustAllNotebooks',
        'Trust all notebooks'
    );
    export const insecureSessionMessage = localize(
        'DataScience.insecureSessionMessage',
        'Connecting over HTTP without a token may be an insecure connection. Do you want to connect to a possibly insecure server?'
    );
    export const insecureSessionDenied = localize(
        'DataScience.insecureSessionDenied',
        'Denied connection to insecure server.'
    );
    export const previewNotebookOnlySupportedInVSCInsiders = localize(
        'DataScience.previewNotebookOnlySupportedInVSCInsiders',
        'The Preview Notebook Editor is supported only in the Insiders version of Visual Studio Code.'
    );
    export const connected = localize('DataScience.connected', 'Connected');
    export const disconnected = localize('DataScience.disconnected', 'Disconnected');
    export const ipykernelNotInstalled = localize(
        'DataScience.ipykernelNotInstalled',
        'IPyKernel not installed into interpreter {0}'
    );
    export const illegalEditorConfig = localize(
        'DataScience.illegalEditorConfig',
        'CustomEditor and NativeNotebook experiments cannot be turned on together'
    );
    export const invalidCustomEditor = localize(
        'DataScience.invalidCustomEditor',
        'Using the Jupyter notebook editor requires the stable version of VS code and the CustomEditor experiment to be enabled.'
    );
}

export namespace DebugConfigStrings {
    export const selectConfiguration = {
        title: localize('debug.selectConfigurationTitle'),
        placeholder: localize('debug.selectConfigurationPlaceholder')
    };
}

export namespace OutdatedDebugger {
    export const outdatedDebuggerMessage = localize(
        'OutdatedDebugger.updateDebuggerMessage',
        'We noticed you are attaching to ptvsd (Python debugger), which was deprecated on May 1st, 2020. Please switch to [debugpy](https://aka.ms/migrateToDebugpy).'
    );
}

// Skip using vscode-nls and instead just compute our strings based on key values. Key values
// can be loaded out of the nls.<locale>.json files
let loadedCollection: Record<string, string> | undefined;
let defaultCollection: Record<string, string> | undefined;
let askedForCollection: Record<string, string> = {};
let loadedLocale: string;

// This is exported only for testing purposes.
export function _resetCollections() {
    loadedLocale = '';
    loadedCollection = undefined;
    askedForCollection = {};
}

// This is exported only for testing purposes.
export function _getAskedForCollection() {
    return askedForCollection;
}

// Return the effective set of all localization strings, by key.
//
// This should not be used for direct lookup.
export function getCollectionJSON(): string {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // Combine the default and loaded collections
    return JSON.stringify({ ...defaultCollection, ...loadedCollection });
}

// tslint:disable-next-line:no-suspicious-comment
export function localize(key: string, defValue?: string) {
    // Return a pointer to function so that we refetch it on each call.
    return () => {
        return getString(key, defValue);
    };
}

function parseLocale(): string {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString).locale : 'en-us';
}

function getString(key: string, defValue?: string) {
    // Load the current collection
    if (!loadedCollection || parseLocale() !== loadedLocale) {
        load();
    }

    // The default collection (package.nls.json) is the fallback.
    // Note that we are guaranteed the following (during shipping)
    //  1. defaultCollection was initialized by the load() call above
    //  2. defaultCollection has the key (see the "keys exist" test)
    let collection = defaultCollection!;

    // Use the current locale if the key is defined there.
    if (loadedCollection && loadedCollection.hasOwnProperty(key)) {
        collection = loadedCollection;
    }
    let result = collection[key];
    if (!result && defValue) {
        // This can happen during development if you haven't fixed up the nls file yet or
        // if for some reason somebody broke the functional test.
        result = defValue;
    }
    askedForCollection[key] = result;

    return result;
}

function load() {
    // Figure out our current locale.
    loadedLocale = parseLocale();

    // Find the nls file that matches (if there is one)
    const nlsFile = path.join(EXTENSION_ROOT_DIR, `package.nls.${loadedLocale}.json`);
    if (fs.pathExistsSync(nlsFile)) {
        const contents = fs.readFileSync(nlsFile, 'utf-8');
        loadedCollection = JSON.parse(contents);
    } else {
        // If there isn't one, at least remember that we looked so we don't try to load a second time
        loadedCollection = {};
    }

    // Get the default collection if necessary. Strings may be in the default or the locale json
    if (!defaultCollection) {
        const defaultNlsFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');
        if (fs.pathExistsSync(defaultNlsFile)) {
            const contents = fs.readFileSync(defaultNlsFile, 'utf-8');
            defaultCollection = JSON.parse(contents);
        } else {
            defaultCollection = {};
        }
    }
}

// Default to loading the current locale
load();
