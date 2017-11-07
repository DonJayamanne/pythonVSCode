import * as assert from 'assert';
import * as path from 'path';
import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { PythonPathUpdaterService } from '../../client/interpreter/configuration/pythonPathUpdaterService';
import { PythonPathUpdaterServiceFactory } from '../../client/interpreter/configuration/pythonPathUpdaterServiceFactory';
import { WorkspaceFolderPythonPathUpdaterService } from '../../client/interpreter/configuration/services/workspaceFolderUpdaterService';
import { WorkspacePythonPathUpdaterService } from '../../client/interpreter/configuration/services/workspaceUpdaterService';
import { InterpreterVersionService } from '../../client/interpreter/interpreterVersion';
import { closeActiveWindows, initialize, initializeTest, IS_MULTI_ROOT_TEST } from '../initialize';

const multirootPath = path.join(__dirname, '..', '..', '..', 'src', 'testMultiRootWkspc');
const workspace3Uri = Uri.file(path.join(multirootPath, 'workspace3'));

// tslint:disable-next-line:max-func-body-length
suite('Multiroot Python Path Settings Updater', () => {
    suiteSetup(async function () {
        if (!IS_MULTI_ROOT_TEST) {
            // tslint:disable-next-line:no-invalid-this
            this.skip();
        }
        await initialize();
    });
    setup(initializeTest);
    suiteTeardown(async () => {
        await closeActiveWindows();
        await initializeTest();
    });
    teardown(async () => {
        await closeActiveWindows();
        await initializeTest();
    });

    test('Updating Workspace Folder Python Path should work', async () => {
        const workspaceUri = workspace3Uri;
        const workspaceUpdater = new WorkspaceFolderPythonPathUpdaterService(workspace.getWorkspaceFolder(workspaceUri).uri);
        const pythonPath = `xWorkspacePythonPath${new Date().getMilliseconds()}`;
        await workspaceUpdater.updatePythonPath(pythonPath);
        const folderValue = workspace.getConfiguration('python', workspace3Uri).inspect('pythonPath').workspaceFolderValue;
        assert.equal(folderValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Updating Workspace Folder Python Path using the factor service should work', async () => {
        const workspaceUri = workspace3Uri;
        const factory = new PythonPathUpdaterServiceFactory();
        const workspaceUpdater = factory.getWorkspaceFolderPythonPathConfigurationService(workspace.getWorkspaceFolder(workspaceUri).uri);
        const pythonPath = `xWorkspacePythonPathFromFactory${new Date().getMilliseconds()}`;
        await workspaceUpdater.updatePythonPath(pythonPath);
        const folderValue = workspace.getConfiguration('python', workspace3Uri).inspect('pythonPath').workspaceFolderValue;
        assert.equal(folderValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Updating Workspace Python Path using the PythonPathUpdaterService should work', async () => {
        const workspaceUri = workspace3Uri;
        const updaterService = new PythonPathUpdaterService(new PythonPathUpdaterServiceFactory(), new InterpreterVersionService());
        const pythonPath = `xWorkspacePythonPathFromUpdater${new Date().getMilliseconds()}`;
        await updaterService.updatePythonPath(pythonPath, ConfigurationTarget.WorkspaceFolder, 'ui', workspace.getWorkspaceFolder(workspaceUri).uri);
        const folderValue = workspace.getConfiguration('python', workspace3Uri).inspect('pythonPath').workspaceFolderValue;
        assert.equal(folderValue, pythonPath, 'Workspace Python Path not updated');
    });

    test('Python Path should be relative to workspace', async () => {
        const workspaceUri = workspace.getWorkspaceFolder(workspace3Uri).uri;
        const pythonInterpreter = `xWorkspacePythonPath${new Date().getMilliseconds()}`;
        const pythonPath = path.join(workspaceUri.fsPath, 'x', 'y', 'z', pythonInterpreter);
        const workspaceUpdater = new WorkspacePythonPathUpdaterService(workspaceUri);
        await workspaceUpdater.updatePythonPath(pythonPath);
        const workspaceValue = workspace.getConfiguration('python').inspect('pythonPath').workspaceValue;
        // tslint:disable-next-line:no-invalid-template-strings
        assert.equal(workspaceValue, path.join('${workspaceRoot}', 'x', 'y', 'z', pythonInterpreter), 'Workspace Python Path not updated');
    });
});
