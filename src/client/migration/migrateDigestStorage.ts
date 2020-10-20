import * as path from 'path';
import { traceInfo } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IExtensionContext } from '../common/types';
import { PythonExtension } from '../datascience/constants';

export const trustDirectoryMigrated = 'trustDirectoryMigrated';

export class MigrateDigestStorage {
    private currentExtensionStorageDir: string;
    private pythonExtensionStorageDir: string;
    private ensuredDir: Promise<void>;

    constructor(private extensionContext: IExtensionContext, private fs: IFileSystem) {
        this.currentExtensionStorageDir = this.extensionContext.globalStoragePath;
        this.pythonExtensionStorageDir = path.join(
            path.resolve(this.currentExtensionStorageDir, '..'),
            PythonExtension
        );
        this.ensuredDir = this.fs.ensureLocalDir(this.currentExtensionStorageDir);
    }

    /**
     * Copy pythonExtensionStorage/nbsecret if it exists
     */
    public async migrateKey() {
        const trustKeyMigrated = 'trustKeyMigrated';
        if (!this.extensionContext.globalState.get(trustKeyMigrated)) {
            try {
                await this.ensuredDir;
                const nbsecret = path.join(this.pythonExtensionStorageDir, 'nbsecret');
                await this.fs.copyLocal(nbsecret, path.join(this.currentExtensionStorageDir, 'nbsecret'));
            } catch (e) {
                traceInfo('Encountered error while migrating trusted notebooks nbsecret keyfile', e);
            } finally {
                await this.extensionContext.globalState.update(trustKeyMigrated, true);
            }
        }
    }

    /**
     * Copy pythonExtensionStorage/nbsignatures if it exists
     */
    public async migrateDir() {
        if (!this.extensionContext.globalState.get(trustDirectoryMigrated)) {
            try {
                await this.ensuredDir;
                const nbsignatures = path.join(this.pythonExtensionStorageDir, 'nbsignatures');
                await this.fs.copyLocal(nbsignatures, path.join(this.currentExtensionStorageDir, 'nbsignatures'));
            } catch (e) {
                traceInfo('Encountered error while migrating trusted notebooks nbsignatures directory', e);
            } finally {
                await this.extensionContext.globalState.update(trustDirectoryMigrated, true);
            }
        }
    }
}
