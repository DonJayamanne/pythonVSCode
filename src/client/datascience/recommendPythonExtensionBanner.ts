import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../activation/types';
import { IPythonExtensionChecker } from '../api/types';
import { isPythonNotebook } from './notebook/helpers/helpers';
import { INotebookEditor, INotebookEditorProvider } from './types';

@injectable()
export class RecommendPythonExtensionBanner implements IExtensionSingleActivationService {
    constructor(
        @inject(INotebookEditorProvider) private notebookEditorProvider: INotebookEditorProvider,
        @inject(IPythonExtensionChecker) private pythonExtensionChecker: IPythonExtensionChecker
    ) {}

    public async activate() {
        this.notebookEditorProvider.onDidOpenNotebookEditor(this.openedNotebook.bind(this));
    }

    private async openedNotebook(editor: INotebookEditor) {
        if (
            !this.pythonExtensionChecker.isPythonExtensionInstalled &&
            editor.model.metadata &&
            isPythonNotebook(editor.model.metadata)
        ) {
            await this.pythonExtensionChecker.showPythonExtensionInstallRecommendedPrompt();
        }
    }
}
