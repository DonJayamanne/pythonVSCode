// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as assert from 'assert';
import * as net from 'net';
import * as sinon from 'sinon';
import * as crypto from 'crypto';
import { Observable } from 'rxjs';
import * as typeMoq from 'typemoq';
import { OutputChannel, Uri } from 'vscode';
import {
    IPythonExecutionFactory,
    IPythonExecutionService,
    ObservableExecutionResult,
    Output,
} from '../../../client/common/process/types';
import { PythonTestServer } from '../../../client/testing/testController/common/server';
import { ITestDebugLauncher } from '../../../client/testing/common/types';
import { Deferred, createDeferred } from '../../../client/common/utils/async';
import { MockChildProcess } from '../../mocks/mockChildProcess';
import {
    PAYLOAD_MULTI_CHUNK,
    PAYLOAD_SINGLE_CHUNK,
    PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY,
    DataWithPayloadChunks,
} from './payloadTestCases';
import { traceLog } from '../../../client/logging';

const testCases = [
    {
        val: () => PAYLOAD_SINGLE_CHUNK('fake-uuid'),
    },
    {
        val: () => PAYLOAD_MULTI_CHUNK('fake-uuid'),
    },
    {
        val: () => PAYLOAD_SPLIT_ACROSS_CHUNKS_ARRAY('fake-uuid'),
    },
];

suite('Python Test Server, DataWithPayloadChunks', () => {
    const FAKE_UUID = 'fake-uuid';
    let server: PythonTestServer;
    let v4Stub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;
    let mockProc: MockChildProcess;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    const sandbox = sinon.createSandbox();

    setup(async () => {
        // set up test command options

        v4Stub = sandbox.stub(crypto, 'randomUUID');
        v4Stub.returns(FAKE_UUID);

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        const outputObservable = new Observable<Output<string>>(() => {
            /* no op */
        });
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => ({
                proc: mockProc,
                out: outputObservable,
                dispose: () => {
                    /* no-body */
                },
            }));
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
    });

    teardown(() => {
        sandbox.restore();
        server.dispose();
    });

    testCases.forEach((testCase) => {
        test(`run correctly`, async () => {
            const testCaseDataObj: DataWithPayloadChunks = testCase.val();
            let eventData = '';
            const client = new net.Socket();

            deferred = createDeferred();
            mockProc = new MockChildProcess('', ['']);
            const output2 = new Observable<Output<string>>(() => {
                /* no op */
            });
            const stubExecutionService2 = ({
                execObservable: () => {
                    client.connect(server.getPort());
                    return {
                        proc: mockProc,
                        out: output2,
                        dispose: () => {
                            /* no-body */
                        },
                    };
                },
            } as unknown) as IPythonExecutionService;

            const stubExecutionFactory2 = ({
                createActivatedEnvironment: () => Promise.resolve(stubExecutionService2),
            } as unknown) as IPythonExecutionFactory;
            server = new PythonTestServer(stubExecutionFactory2, debugLauncher);
            const uuid = server.createUUID();
            const options = {
                command: { script: 'myscript', args: ['-foo', 'foo'] },
                workspaceFolder: Uri.file('/foo/bar'),
                cwd: '/foo/bar',
                uuid,
            };

            const dataWithPayloadChunks = testCaseDataObj;

            await server.serverReady();

            server.onRunDataReceived(({ data }) => {
                try {
                    const resultData = JSON.parse(data).result;
                    eventData = eventData + JSON.stringify(resultData);
                } catch (e) {
                    assert(false, 'Error parsing data');
                }
                deferred.resolve();
            });
            client.on('connect', () => {
                traceLog('Socket connected, local port:', client.localPort);
                // since this test is a single payload as a single chunk there should be a single line in the payload.
                for (const line of dataWithPayloadChunks.payloadArray) {
                    client.write(line);
                }
                client.end();
            });
            client.on('error', (error) => {
                traceLog('Socket connection error:', error);
            });

            server.sendCommand(options);
            await deferred.promise;
            const expectedResult = dataWithPayloadChunks.data;
            assert.deepStrictEqual(eventData, expectedResult);
        });
    });
});

suite('Python Test Server, Send command etc', () => {
    const FAKE_UUID = 'fake-uuid';
    let server: PythonTestServer;
    let v4Stub: sinon.SinonStub;
    let debugLauncher: ITestDebugLauncher;
    let mockProc: MockChildProcess;
    let execService: typeMoq.IMock<IPythonExecutionService>;
    let deferred: Deferred<void>;
    const sandbox = sinon.createSandbox();

    setup(async () => {
        // set up test command options

        v4Stub = sandbox.stub(crypto, 'randomUUID');
        v4Stub.returns(FAKE_UUID);

        // set up exec service with child process
        mockProc = new MockChildProcess('', ['']);
        execService = typeMoq.Mock.ofType<IPythonExecutionService>();
        execService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
    });

    teardown(() => {
        sandbox.restore();
        server.dispose();
    });
    test('sendCommand should add the port to the command being sent and add the correct extra spawn variables', async () => {
        const deferred2 = createDeferred();
        const RUN_TEST_IDS_PORT_CONST = '5678';
        execService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns((_args, options2) => {
                try {
                    assert.strictEqual(
                        options2.extraVariables.PYTHONPATH,
                        '/foo/bar',
                        'Expect python path to exist as extra variable and be set correctly',
                    );
                    assert.strictEqual(
                        options2.extraVariables.RUN_TEST_IDS_PORT,
                        RUN_TEST_IDS_PORT_CONST,
                        'Expect test id port to be in extra variables and set correctly',
                    );
                } catch (e) {
                    assert(false, 'Error parsing data, extra variables do not match');
                }
                return typeMoq.Mock.ofType<ObservableExecutionResult<string>>().object;
            });
        const execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(execService.object);
            });
        server = new PythonTestServer(execFactory.object, debugLauncher);
        await server.serverReady();
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: FAKE_UUID,
        };
        server.sendCommand(options, RUN_TEST_IDS_PORT_CONST);
        // add in await and trigger
        await deferred2.promise;
        mockProc.trigger('close');

        const port = server.getPort();
        const expectedArgs = ['myscript', '--port', `${port}`, '--uuid', FAKE_UUID, '-foo', 'foo'];
        execService.verify((x) => x.execObservable(expectedArgs, typeMoq.It.isAny()), typeMoq.Times.once());
    });

    test('sendCommand should write to an output channel if it is provided as an option', async () => {
        const output2: string[] = [];
        const outChannel = {
            appendLine: (str: string) => {
                output2.push(str);
            },
        } as OutputChannel;
        const options = {
            command: {
                script: 'myscript',
                args: ['-foo', 'foo'],
            },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: FAKE_UUID,
            outChannel,
        };
        deferred = createDeferred();
        const execFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        execFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred.resolve();
                return Promise.resolve(execService.object);
            });

        server = new PythonTestServer(execFactory.object, debugLauncher);
        await server.serverReady();

        server.sendCommand(options);
        // add in await and trigger
        await deferred.promise;
        mockProc.trigger('close');

        const port = server.getPort();
        const expected = ['python', 'myscript', '--port', `${port}`, '--uuid', FAKE_UUID, '-foo', 'foo'].join(' ');

        assert.deepStrictEqual(output2, [expected]);
    });

    test('If script execution fails during sendCommand, an onDataReceived event should be fired with the "error" status', async () => {
        let eventData: { status: string; errors: string[] } | undefined;
        const deferred2 = createDeferred();
        const deferred3 = createDeferred();
        const stubExecutionService = typeMoq.Mock.ofType<IPythonExecutionService>();
        stubExecutionService.setup((p) => ((p as unknown) as any).then).returns(() => undefined);
        stubExecutionService
            .setup((x) => x.execObservable(typeMoq.It.isAny(), typeMoq.It.isAny()))
            .returns(() => {
                deferred3.resolve();
                throw new Error('Failed to execute');
            });
        const options = {
            command: { script: 'myscript', args: ['-foo', 'foo'] },
            workspaceFolder: Uri.file('/foo/bar'),
            cwd: '/foo/bar',
            uuid: FAKE_UUID,
        };
        const stubExecutionFactory = typeMoq.Mock.ofType<IPythonExecutionFactory>();
        stubExecutionFactory
            .setup((x) => x.createActivatedEnvironment(typeMoq.It.isAny()))
            .returns(() => {
                deferred2.resolve();
                return Promise.resolve(stubExecutionService.object);
            });

        server = new PythonTestServer(stubExecutionFactory.object, debugLauncher);
        await server.serverReady();

        server.onDataReceived(({ data }) => {
            eventData = JSON.parse(data);
        });

        server.sendCommand(options);
        await deferred2.promise;
        await deferred3.promise;
        assert.notEqual(eventData, undefined);
        assert.deepStrictEqual(eventData?.status, 'error');
        assert.deepStrictEqual(eventData?.errors, ['Failed to execute']);
    });
});
