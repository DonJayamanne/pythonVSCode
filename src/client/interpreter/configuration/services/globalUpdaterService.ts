import { ConfigurationTarget, Uri, workspace } from 'vscode';
import { InterpreterManager } from '../..';
import { WorkspacePythonPath } from '../../contracts';
import { IPythonPathUpdaterService } from '../types';

export class GlobalPythonPathUpdaterService implements IPythonPathUpdaterService {
    public async updatePythonPath(pythonPath: string): Promise<void> {
        const pythonPathValue = workspace.getConfiguration('python').inspect<string>('pythonPath');

        if (pythonPathValue && pythonPathValue.globalValue === pythonPath) {
            return;
        }
        const pythonConfig = workspace.getConfiguration('python');
        await pythonConfig.update('pythonPath', pythonPath, true);
    }
}
