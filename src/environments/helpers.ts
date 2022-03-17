import { workspace } from 'vscode';
import * as path from 'path';
import * as tmp from 'tmp';
import { EnvironmentType, PythonEnvironment } from '../client/pythonEnvironments/info';
import { TemporaryFile } from '../client/common/platform/types';

const untildify = require('untildify');

const home = untildify('~');

export function getEnvironmentId(env: PythonEnvironment) {
    return `${env.envName}:${env.path}`;
}

export function getDisplayPath(value?: string) {
    if (!value) {
        return '';
    }
    value = workspace.asRelativePath(value, false);
    return value.startsWith(home) ? `~${path.sep}${path.relative(home, value)}` : value;
}

export function getEnvironmentTypeName(type: EnvironmentType) {
    return type.toString();
}

export function createTempFile(extension = '.txt') {
    return new Promise<TemporaryFile>((resolve, reject) => {
        tmp.file({ postfix: extension }, (err, filename, _fd, cleanUp) => {
            if (err) {
                return reject(err);
            }
            resolve({
                filePath: filename,
                dispose: cleanUp,
            });
        });
    });
}
