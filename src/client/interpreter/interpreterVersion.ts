import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import '../common/extensions';
import { IProcessServiceFactory } from '../common/process/processServiceFactory';
import { IInterpreterVersionService } from './contracts';

const PIP_VERSION_REGEX = '\\d\\.\\d(\\.\\d)+';

@injectable()
export class InterpreterVersionService implements IInterpreterVersionService {
    constructor( @inject(IProcessServiceFactory) private processServiceFactory: IProcessServiceFactory) { }
    public async getVersion(pythonPath: string, defaultValue: string, resoruce: Uri): Promise<string> {
        const processService = this.processServiceFactory.create(resoruce);
        return processService.exec(pythonPath, ['--version'], { mergeStdOutErr: true })
            .then(output => output.stdout.splitLines()[0])
            .then(version => version.length === 0 ? defaultValue : version)
            .catch(() => defaultValue);
    }
    public async getPipVersion(pythonPath: string, resoruce: Uri): Promise<string> {
        const processService = this.processServiceFactory.create(resoruce);
        const output = await processService.exec(pythonPath, ['-m', 'pip', '--version'], { mergeStdOutErr: true });
        if (output.stdout.length > 0) {
            // Here's a sample output:
            // pip 9.0.1 from /Users/donjayamanne/anaconda3/lib/python3.6/site-packages (python 3.6).
            const re = new RegExp(PIP_VERSION_REGEX, 'g');
            const matches = re.exec(output.stdout);
            if (matches && matches.length > 0) {
                return matches[0].trim();
            }
        }
        throw new Error(`Unable to determine Pip version from output '${output.stdout}'`);
    }
}
