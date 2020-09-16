import { inject, injectable } from 'inversify';
import { IPythonApiProvider, PythonApi } from '../client/api/types';
import { MockPythonApi } from './mockPythonApi';

@injectable()
export class MockPythonApiProvider implements IPythonApiProvider {
    constructor(@inject(MockPythonApi) private readonly mockPythonApi: MockPythonApi) {}
    public async getApi(): Promise<PythonApi> {
        return this.mockPythonApi;
    }
    public setApi(_api: PythonApi): void {
        // ignored
    }
}
