import { IVirtualEnvironment } from "./contracts";
import * as path from 'path';
import { fsExistsAsync } from '../../common/utils';

const pyEnvCfgFileName = 'pyvenv.cfg';

export class VEnv implements IVirtualEnvironment {
    public readonly name: string = 'venv';

    detect(pythonPath: string): Promise<boolean> {
        const dir = path.dirname(pythonPath);
        const pyEnvCfgPath = path.join(dir, '..', pyEnvCfgFileName);
        return fsExistsAsync(pyEnvCfgPath);
    }
}