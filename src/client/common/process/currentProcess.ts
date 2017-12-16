import { injectable } from 'inversify';
import 'reflect-metadata';
import { ICurrentProcess } from '../types';
import { EnvironmentVariables } from '../variables/types';

@injectable()
export class CurrentProcess implements ICurrentProcess {
    public get env(): EnvironmentVariables {
        return process.env;
    }
}
