import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as uuid from 'uuid/v4';
import { Uri } from 'vscode';
import { TemporaryDirectory } from '../../common/platform/types';
import { sleep } from '../../common/utils/async';
import { ICell, IDataScienceFileSystem, INotebookExporter, INotebookModel, INotebookStorage } from '../types';

@injectable()
export class ExportUtil {
    constructor(
        @inject(IDataScienceFileSystem) private fs: IDataScienceFileSystem,
        @inject(INotebookStorage) private notebookStorage: INotebookStorage,
        @inject(INotebookExporter) private jupyterExporter: INotebookExporter
    ) {}

    public async generateTempDir(): Promise<TemporaryDirectory> {
        const resultDir = path.join(os.tmpdir(), uuid());
        await this.fs.createLocalDirectory(resultDir);

        return {
            path: resultDir,
            dispose: async () => {
                // Try ten times. Process may still be up and running.
                // We don't want to do async as async dispose means it may never finish and then we don't
                // delete
                let count = 0;
                while (count < 10) {
                    try {
                        await this.fs.deleteLocalDirectory(resultDir);
                        count = 10;
                    } catch {
                        await sleep(3000);
                        count += 1;
                    }
                }
            }
        };
    }

    public async makeFileInDirectory(model: INotebookModel, fileName: string, dirPath: string): Promise<string> {
        const newFilePath = path.join(dirPath, fileName);

        await this.fs.writeLocalFile(newFilePath, model.getContent());

        return newFilePath;
    }

    public async getModelFromCells(cells: ICell[]): Promise<INotebookModel> {
        const tempDir = await this.generateTempDir();
        const tempFile = await this.fs.createTemporaryLocalFile('.ipynb');
        let model: INotebookModel;

        try {
            await this.jupyterExporter.exportToFile(cells, tempFile.filePath, false);
            const newPath = path.join(tempDir.path, '.ipynb');
            await this.fs.copyLocal(tempFile.filePath, newPath);
            model = await this.notebookStorage.getOrCreateModel(Uri.file(newPath));
        } finally {
            tempFile.dispose();
            tempDir.dispose();
        }

        return model;
    }
}
