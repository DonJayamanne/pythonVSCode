import { OutputChannel, Uri } from 'vscode';
import { ITestManagerService, ITestManagerServiceFactory } from './contracts';
import { TestManagerService } from './testManagerService';

export class TestManagerServiceFactory implements ITestManagerServiceFactory {
    constructor(private outChannel: OutputChannel) { }
    public createTestManagerService(wkspace: Uri): ITestManagerService {
        return new TestManagerService(wkspace, this.outChannel);
    }
}
