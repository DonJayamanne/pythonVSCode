import { IVirtualEnvironment } from "./contracts";
import * as path from 'path';
import { validatePath, IS_WINDOWS } from '../../common/utils';

const OrigPrefixFile = 'orig-prefix.txt';

export class VirtualEnv implements IVirtualEnvironment {
    public readonly name: string = 'virtualenv';

    detect(pythonPath: string): Promise<boolean> {
        return IS_WINDOWS ? this.detectOnWindows(pythonPath) : this.detectOnNonWindows(pythonPath);
    }
    private detectOnWindows(pythonPath: string) {
        const dir = path.dirname(pythonPath);
        const origPrefixFile = path.join(dir, 'lib', OrigPrefixFile);
        return validatePath(origPrefixFile).then(p => p === origPrefixFile);
    }
    private detectOnNonWindows(pythonPath: string) {
        //TODO:
        return Promise.resolve(false);
    }
}