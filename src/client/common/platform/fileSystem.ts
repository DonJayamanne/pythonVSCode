import * as fs from 'fs-extra';
import * as glob from 'glob';
import { injectable } from 'inversify';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { traceError } from '../logger';
import { createDirNotEmptyError, isFileNotFoundError } from './errors';
import { convertFileType, convertStat, getHashString } from './fileSystemUtils';
import { FileSystemPathUtils } from './fs-paths';
import { FileType, IFileSystem, IFileSystemPathUtils, TemporaryFile } from './types';

const ENCODING = 'utf8';

/**
 * File system abstraction which wraps the VS Code API.
 */
@injectable()
export class FileSystem implements IFileSystem {
    protected vscfs: vscode.FileSystem;
    private globFiles: (pat: string, options?: { cwd: string; dot?: boolean }) => Promise<string[]>;
    private fsPathUtils: IFileSystemPathUtils;
    constructor() {
        this.globFiles = promisify(glob);
        this.fsPathUtils = FileSystemPathUtils.withDefaults();
        this.vscfs = vscode.workspace.fs;
    }

    public async appendLocalFile(path: string, text: string): Promise<void> {
        return fs.appendFile(path, text);
    }

    public areLocalPathsSame(path1: string, path2: string): boolean {
        return this.fsPathUtils.arePathsSame(path1, path2);
    }

    public async createLocalDirectory(path: string): Promise<void> {
        await this.createDirectory(vscode.Uri.file(path));
    }

    public createLocalWriteStream(path: string): fs.WriteStream {
        return fs.createWriteStream(path);
    }

    public async copyLocal(source: string, destination: string): Promise<void> {
        const srcUri = vscode.Uri.file(source);
        const dstUri = vscode.Uri.file(destination);
        await this.vscfs.copy(srcUri, dstUri, { overwrite: true });
    }

    public async createTemporaryLocalFile(suffix: string, mode?: number): Promise<TemporaryFile> {
        const opts = {
            postfix: suffix,
            mode
        };
        return new Promise<TemporaryFile>((resolve, reject) => {
            tmp.file(opts, (err, filename, _fd, cleanUp) => {
                if (err) {
                    return reject(err);
                }
                resolve({
                    filePath: filename,
                    dispose: cleanUp
                });
            });
        });
    }

    public async deleteLocalDirectory(dirname: string) {
        const uri = vscode.Uri.file(dirname);
        // The "recursive" option disallows directories, even if they
        // are empty.  So we have to deal with this ourselves.
        const files = await this.vscfs.readDirectory(uri);
        if (files && files.length > 0) {
            throw createDirNotEmptyError(dirname);
        }
        return this.vscfs.delete(uri, {
            recursive: true,
            useTrash: false
        });
    }

    public async deleteLocalFile(path: string): Promise<void> {
        const uri = vscode.Uri.file(path);
        return this.vscfs.delete(uri, {
            recursive: false,
            useTrash: false
        });
    }

    public async ensureLocalDir(path: string): Promise<void> {
        return fs.ensureDir(path);
    }

    public getDisplayName(filename: string, cwd?: string): string {
        return this.fsPathUtils.getDisplayName(filename, cwd);
    }

    public async getFileHash(filename: string): Promise<string> {
        // The reason for lstat rather than stat is not clear...
        const stat = await this.lstat(filename);
        const data = `${stat.ctime}-${stat.mtime}`;
        return getHashString(data);
    }

    public async localDirectoryExists(dirname: string): Promise<boolean> {
        return this.localPathExists(dirname, FileType.Directory);
    }

    public async localFileExists(filename: string): Promise<boolean> {
        return this.localPathExists(filename, FileType.File);
    }

    public async readLocalData(filename: string): Promise<Buffer> {
        const uri = vscode.Uri.file(filename);
        const data = await this.vscfs.readFile(uri);
        return Buffer.from(data);
    }

    public async readLocalFile(filename: string): Promise<string> {
        const uri = vscode.Uri.file(filename);
        return this.readFile(uri);
    }

    public async searchLocal(globPattern: string, cwd?: string, dot?: boolean): Promise<string[]> {
        // tslint:disable-next-line: no-any
        let options: any;
        if (cwd) {
            options = { ...options, cwd };
        }
        if (dot) {
            options = { ...options, dot };
        }

        const found = await this.globFiles(globPattern, options);
        return Array.isArray(found) ? found : [];
    }

    public async getFiles(dir: vscode.Uri): Promise<vscode.Uri[]> {
        const files = await this.vscfs.readDirectory(dir);
        return files.filter((f) => f[1] === FileType.File).map((f) => vscode.Uri.file(f[0]));
    }

    public async writeLocalFile(filename: string, text: string | Buffer): Promise<void> {
        const uri = vscode.Uri.file(filename);
        return this.writeFile(uri, text);
    }

    // URI-based filesystem functions for interacting with files provided by VS Code
    public arePathsSame(path1: vscode.Uri, path2: vscode.Uri): boolean {
        if (path1.scheme === 'file' && path1.scheme === path2.scheme) {
            return this.areLocalPathsSame(path1.fsPath, path2.fsPath);
        } else {
            return path1.toString() === path2.toString();
        }
    }

    public async copy(source: vscode.Uri, destination: vscode.Uri): Promise<void> {
        await this.vscfs.copy(source, destination);
    }

    public async createDirectory(uri: vscode.Uri): Promise<void> {
        await this.vscfs.createDirectory(uri);
    }

    public async delete(uri: vscode.Uri): Promise<void> {
        await this.vscfs.delete(uri);
    }

    public async readFile(uri: vscode.Uri): Promise<string> {
        const result = await this.vscfs.readFile(uri);
        const data = Buffer.from(result);
        return data.toString(ENCODING);
    }

    public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        return this.vscfs.stat(uri);
    }

    public async writeFile(uri: vscode.Uri, text: string | Buffer): Promise<void> {
        const data = typeof text === 'string' ? Buffer.from(text) : text;
        return this.vscfs.writeFile(uri, data);
    }

    private async lstat(filename: string): Promise<vscode.FileStat> {
        // tslint:disable-next-line: no-suspicious-comment
        // TODO https://github.com/microsoft/vscode/issues/71204 (84514)):
        //   This functionality has been requested for the VS Code API.
        const stat = await fs.lstat(filename);
        // Note that, unlike stat(), lstat() does not include the type
        // of the symlink's target.
        const fileType = convertFileType(stat);
        return convertStat(stat, fileType);
    }

    private async localPathExists(
        // the "file" to look for
        filename: string,
        // the file type to expect; if not provided then any file type
        // matches; otherwise a mismatch results in a "false" value
        fileType?: FileType
    ): Promise<boolean> {
        let stat: vscode.FileStat;
        try {
            // Note that we are using stat() rather than lstat().  This
            // means that any symlinks are getting resolved.
            const uri = vscode.Uri.file(filename);
            stat = await this.stat(uri);
        } catch (err) {
            if (isFileNotFoundError(err)) {
                return false;
            }
            traceError(`stat() failed for "${filename}"`, err);
            return false;
        }

        if (fileType === undefined) {
            return true;
        }
        if (fileType === FileType.Unknown) {
            // FileType.Unknown == 0, hence do not use bitwise operations.
            return stat.type === FileType.Unknown;
        }
        return (stat.type & fileType) === fileType;
    }
}
