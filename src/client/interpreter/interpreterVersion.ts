import { getInterpreterDisplayName } from '../common/utils';

export interface IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string>;
}

export class InterpreterVersionService implements IInterpreterVersionService {
    getVersion(pythonPath: string, defaultValue: string): Promise<string> {
        return getInterpreterDisplayName(pythonPath)
            .catch(() => defaultValue);
    }
}
