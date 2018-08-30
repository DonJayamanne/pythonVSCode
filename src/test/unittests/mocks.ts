import { EventEmitter } from 'events';
import { injectable } from 'inversify';
import { CancellationToken, Disposable, Uri } from 'vscode';
import { createDeferred, Deferred } from '../../client/common/helpers';
import { Product } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import { CANCELLATION_REASON } from '../../client/unittests/common/constants';
import { BaseTestManager } from '../../client/unittests/common/managers/baseTestManager';
import { ITestDebugLauncher, ITestDiscoveryService, IUnitTestSocketServer, LaunchOptions, TestDiscoveryOptions, TestProvider, Tests, TestsToRun } from '../../client/unittests/common/types';

@injectable()
export class MockDebugLauncher implements ITestDebugLauncher, Disposable {
    public get launched(): Promise<boolean> {
        return this._launched.promise;
    }
    public get debuggerPromise(): Deferred<Tests> {
        // tslint:disable-next-line:no-non-null-assertion
        return this._promise!;
    }
    public get cancellationToken(): CancellationToken {
        return this._token;
    }
    // tslint:disable-next-line:variable-name
    private _launched: Deferred<boolean>;
    // tslint:disable-next-line:variable-name
    private _promise?: Deferred<Tests>;
    // tslint:disable-next-line:variable-name
    private _token: CancellationToken;
    constructor() {
        this._launched = createDeferred<boolean>();
    }
    public async getLaunchOptions(resource?: Uri): Promise<{ port: number, host: string }> {
        return { port: 0, host: 'localhost' };
    }
    public async launchDebugger(options: LaunchOptions): Promise<void> {
        this._launched.resolve(true);
        // tslint:disable-next-line:no-non-null-assertion
        this._token = options.token!;
        this._promise = createDeferred<Tests>();
        // tslint:disable-next-line:no-non-null-assertion
        options.token!.onCancellationRequested(() => {
            if (this._promise) {
                this._promise.reject('Mock-User Cancelled');
            }
        });
        return this._promise.promise as {} as Promise<void>;
    }
    public dispose() {
        this._promise = undefined;
    }
}

@injectable()
export class MockTestManagerWithRunningTests extends BaseTestManager {
    // tslint:disable-next-line:no-any
    public readonly runnerDeferred = createDeferred<any>();
    public readonly enabled = true;
    // tslint:disable-next-line:no-any
    public readonly discoveryDeferred = createDeferred<Tests>();
    constructor(testProvider: TestProvider, product: Product, workspaceFolder: Uri, rootDirectory: string,
        serviceContainer: IServiceContainer) {
        super(testProvider, product, workspaceFolder, rootDirectory, serviceContainer);
    }
    protected getDiscoveryOptions(ignoreCache: boolean) {
        return {} as TestDiscoveryOptions;
    }
    // tslint:disable-next-line:no-any
    protected async runTestImpl(tests: Tests, testsToRun?: TestsToRun, runFailedTests?: boolean, debug?: boolean): Promise<any> {
        // tslint:disable-next-line:no-non-null-assertion
        this.testRunnerCancellationToken!.onCancellationRequested(() => {
            this.runnerDeferred.reject(CANCELLATION_REASON);
        });
        return this.runnerDeferred.promise;
    }
    protected async discoverTestsImpl(ignoreCache: boolean, debug?: boolean): Promise<Tests> {
        // tslint:disable-next-line:no-non-null-assertion
        this.testDiscoveryCancellationToken!.onCancellationRequested(() => {
            this.discoveryDeferred.reject(CANCELLATION_REASON);
        });
        return this.discoveryDeferred.promise;
    }
}

@injectable()
export class MockDiscoveryService implements ITestDiscoveryService {
    constructor(private discoverPromise: Promise<Tests>) { }
    public async discoverTests(options: TestDiscoveryOptions): Promise<Tests> {
        return this.discoverPromise;
    }
}

// tslint:disable-next-line:max-classes-per-file
@injectable()
export class MockUnitTestSocketServer extends EventEmitter implements IUnitTestSocketServer {
    private results: {}[] = [];
    public reset() {
        this.removeAllListeners();
    }
    public addResults(results: {}[]) {
        this.results.push(...results);
    }
    public async start(options: { port: number, host: string } = { port: 0, host: 'localhost' }): Promise<number> {
        this.results.forEach(result => {
            this.emit('result', result);
        });
        this.results = [];
        return typeof options.port === 'number' ? options.port! : 0;
    }
    // tslint:disable-next-line:no-empty
    public stop(): void { }
    // tslint:disable-next-line:no-empty
    public dispose() { }
}
