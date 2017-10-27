import { Disposable, OutputChannel, Uri, workspace } from 'vscode';
import { PythonSettings } from '../../common/configSettings';
import { Product } from '../../common/installer';
import { TestManager as NoseTestManager } from '../nosetest/main';
import { TestManager as PyTestTestManager } from '../pytest/main';
import { TestManager as UnitTestTestManager } from '../unittest/main';
import { BaseTestManager } from './baseTestManager';
import { ITestManagerService, ITestManagerServiceFactory, IWorkspaceTestManagerService, UnitTestProduct } from './contracts';
import { TestManagerService } from './testManagerService';

type TestManagerInstanceInfo = { instance?: BaseTestManager, create(rootDirectory: string): BaseTestManager };

export class WorkspaceTestManagerService implements IWorkspaceTestManagerService, Disposable {
    private workspaceTestManagers = new Map<string, ITestManagerService>();
    private workspaceTestSettings = new Map<string, string>();
    private disposables: Disposable[] = [];
    constructor(private outChannel: OutputChannel,
        private testManagerServiceFactory: ITestManagerServiceFactory) {
        // workspace.onDidChangeConfiguration(this.monitorChangesToTestSettings, this, this.disposables);
    }
    public dispose() {
        this.workspaceTestManagers.forEach(info => info.dispose());
    }
    public getTestManager(wkspace: Uri): BaseTestManager | undefined {
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestManager();
    }
    public getTestWorkingDirectory(wkspace: Uri) {
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getTestWorkingDirectory();
    }
    public getPreferredTestManager(wkspace: Uri): UnitTestProduct {
        this.ensureTestManagerService(wkspace);
        return this.workspaceTestManagers.get(wkspace.fsPath).getPreferredTestManager();
    }
    private ensureTestManagerService(wkspace: Uri) {
        if (!this.workspaceTestManagers.has(wkspace.fsPath)) {
            this.workspaceTestManagers.set(wkspace.fsPath, this.testManagerServiceFactory.createTestManagerService(wkspace));
            // this.trackTestSettings(wkspace);
        }
    }
    // private trackTestSettings(wkspace: Uri) {
    //     const pythonConfig = workspace.getConfiguration('python', wkspace);
    //     // tslint:disable-next-line:no-backbone-get-set-outside-model
    //     const unitTestSettings = pythonConfig.get<{}>('unitTest');
    //     this.workspaceTestSettings.set(wkspace.fsPath, JSON.stringify(unitTestSettings));
    // }
    // private monitorChangesToTestSettings() {
    //     this.workspaceTestSettings.forEach((_, workspacePath) => {
    //         const testSettingsChanged = this.checkForChangesInSettings(Uri.file(workspacePath));
    //         if (testSettingsChanged) {
    //             this.rebuildTestManagers(workspace);
    //         }
    //     });
    // }
    // private rebuildTestManagers(wkspace: Uri) {
    //     if (!this.workspaceTestManagers.get(wkspace.fsPath)) {
    //         return;
    //     }
    //     const service = this.workspaceTestManagers.get(wkspace.fsPath);
    //     const mgr = service.getTestManager();
    //     mgr.stop();
    //     mgr.dispose();
    //     service.dispose();
    //     this.ensureTestManagerService(wkspace);
    //     service.getTestManager();
    // }
    // private checkForChangesInSettings(wkspace: Uri) {
    //     const currentSettings = this.workspaceTestSettings.get(wkspace.fsPath);
    //     this.trackTestSettings(wkspace);
    //     const newSettings = this.workspaceTestSettings.get(wkspace.fsPath);
    //     return currentSettings !== newSettings;
    // }
}
