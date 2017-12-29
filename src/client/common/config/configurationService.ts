import { injectable } from 'inversify';
import { Uri } from 'vscode';
import { IPythonSettings, PythonSettings } from '../configSettings';
import { IConfigurationService } from './types';

@injectable()
export class ConfigurationService implements IConfigurationService {
    public getConfiguration(resource?: Uri): Readonly<IPythonSettings> {
        return PythonSettings.getInstance(resource);
    }
}
