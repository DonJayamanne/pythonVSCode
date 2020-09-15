import * as path from 'path';
import { IExtensionContext } from '../common/types';
import { swallowExceptions } from '../common/utils/decorators';
import { IDataScienceFileSystem } from '../datascience/types';

export class MigrateDigestStorage {
    private currentExtensionStorageDir: string;
    private pythonExtensionStorageDir: string;
    private ensuredDir: Promise<void>;

    constructor(private extensionContext: IExtensionContext, private fs: IDataScienceFileSystem) {
        this.currentExtensionStorageDir = this.extensionContext.globalStoragePath;
        this.pythonExtensionStorageDir = path.join(
            path.resolve(this.currentExtensionStorageDir, '..'),
            'ms-python.python'
        );
        this.ensuredDir = this.fs.ensureLocalDir(this.currentExtensionStorageDir);
    }

    /**
     * Copy, then delete, pythonExtensionStorage/nbsecret if it exists
     */
    @swallowExceptions('Migrate trusted notebooks nbsecret keyfile')
    public async migrateKey() {
        const trustKeyMigrated = 'trustKeyMigrated';
        if (!this.extensionContext.globalState.get(trustKeyMigrated)) {
            try {
                await this.ensuredDir;
                const nbsecret = path.join(this.pythonExtensionStorageDir, 'nbsecret');
                await this.fs.copyLocal(nbsecret, path.join(this.currentExtensionStorageDir, 'nbsecret'));
                this.fs.deleteLocalFile(nbsecret).ignoreErrors();
            } finally {
                await this.extensionContext.globalState.update(trustKeyMigrated, true);
            }
        }
    }

    /**
     * Copy, then delete, pythonExtensionStorage/nbsignatures if it exists
     */
    @swallowExceptions('Migrate trusted notebooks nbsignatures directory')
    public async migrateDir() {
        const trustDirectoryMigrated = 'trustDirectoryMigrated';
        if (!this.extensionContext.globalState.get(trustDirectoryMigrated)) {
            try {
                await this.ensuredDir;
                const nbsignatures = path.join(this.pythonExtensionStorageDir, 'nbsignatures');
                await this.fs.copyLocal(nbsignatures, path.join(this.currentExtensionStorageDir, 'nbsignatures'));
                this.fs.deleteLocalDirectory(nbsignatures).ignoreErrors();
            } finally {
                await this.extensionContext.globalState.update(trustDirectoryMigrated, true);
            }
        }
    }
}
