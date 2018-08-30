import * as fs from 'fs-extra';
import * as path from 'path';
import { TextDocument, TextEdit } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { getTempFileWithDocumentContents, getTextEditsFromPatch } from '../common/editor';
import { ExecutionResult, IProcessServiceFactory, IPythonExecutionFactory } from '../common/process/types';
import { IServiceContainer } from '../ioc/types';
import { captureTelemetry } from '../telemetry';
import { FORMAT_SORT_IMPORTS } from '../telemetry/constants';

// tslint:disable-next-line:completed-docs
export class PythonImportSortProvider {
    private readonly processServiceFactory: IProcessServiceFactory;
    private readonly pythonExecutionFactory: IPythonExecutionFactory;
    constructor(serviceContainer: IServiceContainer) {
        this.pythonExecutionFactory = serviceContainer.get<IPythonExecutionFactory>(IPythonExecutionFactory);
        this.processServiceFactory = serviceContainer.get<IProcessServiceFactory>(IProcessServiceFactory);
    }
    @captureTelemetry(FORMAT_SORT_IMPORTS)
    public async sortImports(extensionDir: string, document: TextDocument): Promise<TextEdit[]> {
        if (document.lineCount === 1) {
            return [];
        }
        // isort does have the ability to read from the process input stream and return the formatted code out of the output stream.
        // However they don't support returning the diff of the formatted text when reading data from the input stream.
        // Yes getting text formatted that way avoids having to create a temporary file, however the diffing will have
        // to be done here in node (extension), i.e. extension cpu, i.e. less responsive solution.
        const importScript = path.join(extensionDir, 'pythonFiles', 'sortImports.py');
        const tmpFileCreated = document.isDirty;
        const filePath = tmpFileCreated ? await getTempFileWithDocumentContents(document) : document.fileName;
        const settings = PythonSettings.getInstance(document.uri);
        const isort = settings.sortImports.path;
        const args = [filePath, '--diff'].concat(settings.sortImports.args);
        let promise: Promise<ExecutionResult<string>>;

        if (typeof isort === 'string' && isort.length > 0) {
            // Lets just treat this as a standard tool.
            const processService = await this.processServiceFactory.create(document.uri);
            promise = processService.exec(isort, args, { throwOnStdErr: true });
        } else {
            promise = this.pythonExecutionFactory.create(document.uri)
                .then(executionService => executionService.exec([importScript].concat(args), { throwOnStdErr: true }));
        }

        try {
            const result = await promise;
            return getTextEditsFromPatch(document.getText(), result.stdout);
        } finally {
            if (tmpFileCreated) {
                fs.unlinkSync(filePath);
            }
        }
    }
}
