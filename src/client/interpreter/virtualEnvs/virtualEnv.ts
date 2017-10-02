import { IVirtualEnvironment } from "./contracts";
import * as path from 'path';
import { fsExistsAsync } from '../../common/utils';

const OrigPrefixFile = 'orig-prefix.txt';

export class VirtualEnv implements IVirtualEnvironment {
    public readonly name: string = 'virtualenv';

    detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const origPrefixFile = path.join(dir, '..', 'lib', OrigPrefixFile);
        return fsExistsAsync(origPrefixFile);
    }
}