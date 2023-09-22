// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TestController, TestItem, Uri, TestMessage, Location, TestRun } from 'vscode';
import * as util from 'util';
import { DiscoveredTestPayload, EOTTestPayload, ExecutionTestPayload, ITestResultResolver } from './types';
import { TestProvider } from '../../types';
import { traceError, traceLog } from '../../../logging';
import { Testing } from '../../../common/utils/localize';
import { clearAllChildren, createErrorTestItem, getTestCaseNodes } from './testItemUtilities';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { splitLines } from '../../../common/stringUtils';
import { buildErrorNodeOptions, fixLogLines, populateTestTree } from './utils';
import { Deferred } from '../../../common/utils/async';

export class PythonResultResolver implements ITestResultResolver {
    testController: TestController;

    testProvider: TestProvider;

    public runIdToTestItem: Map<string, TestItem>;

    public runIdToVSid: Map<string, string>;

    public vsIdToRunId: Map<string, string>;

    public subTestStats: Map<string, { passed: number; failed: number }> = new Map();

    constructor(testController: TestController, testProvider: TestProvider, private workspaceUri: Uri) {
        this.testController = testController;
        this.testProvider = testProvider;

        this.runIdToTestItem = new Map<string, TestItem>();
        this.runIdToVSid = new Map<string, string>();
        this.vsIdToRunId = new Map<string, string>();
    }

    public resolveDiscovery(
        payload: DiscoveredTestPayload | EOTTestPayload,
        deferredTillEOT: Deferred<void>,
        token?: CancellationToken,
    ): Promise<void> {
        if (!payload) {
            // No test data is available
            return Promise.resolve();
        }
        if ('eot' in payload) {
            // the payload is an EOT payload, so resolve the deferred promise.
            traceLog('ResultResolver EOT received for discovery.');
            const eotPayload = payload as EOTTestPayload;
            if (eotPayload.eot === true) {
                deferredTillEOT.resolve();
                return Promise.resolve();
            }
        }
        return this._resolveDiscovery(payload as DiscoveredTestPayload, token);
    }

    public _resolveDiscovery(payload: DiscoveredTestPayload, token?: CancellationToken): Promise<void> {
        const workspacePath = this.workspaceUri.fsPath;
        const rawTestData = payload as DiscoveredTestPayload;
        // Check if there were any errors in the discovery process.
        if (rawTestData.status === 'error') {
            const testingErrorConst =
                this.testProvider === 'pytest' ? Testing.errorPytestDiscovery : Testing.errorUnittestDiscovery;
            const { error } = rawTestData;
            traceError(testingErrorConst, '\r\n', error?.join('\r\n\r\n') ?? '');

            let errorNode = this.testController.items.get(`DiscoveryError:${workspacePath}`);
            const message = util.format(
                `${testingErrorConst} ${Testing.seePythonOutput}\r\n`,
                error?.join('\r\n\r\n') ?? '',
            );

            if (errorNode === undefined) {
                const options = buildErrorNodeOptions(this.workspaceUri, message, this.testProvider);
                errorNode = createErrorTestItem(this.testController, options);
                this.testController.items.add(errorNode);
            }
            errorNode.error = message;
        } else {
            // remove error node only if no errors exist.
            this.testController.items.delete(`DiscoveryError:${workspacePath}`);
        }
        if (rawTestData.tests || rawTestData.tests === null) {
            // if any tests exist, they should be populated in the test tree, regardless of whether there were errors or not.
            // parse and insert test data.

            // If the test root for this folder exists: Workspace refresh, update its children.
            // Otherwise, it is a freshly discovered workspace, and we need to create a new test root and populate the test tree.
            populateTestTree(this.testController, rawTestData.tests, undefined, this, token);
        } else {
            // Delete everything from the test controller.
            const errorNode = this.testController.items.get(`DiscoveryError:${workspacePath}`);
            this.testController.items.replace([]);
            // Add back the error node if it exists.
            if (errorNode !== undefined) {
                this.testController.items.add(errorNode);
            }
        }

        sendTelemetryEvent(EventName.UNITTEST_DISCOVERY_DONE, undefined, {
            tool: this.testProvider,
            failed: false,
        });
        return Promise.resolve();
    }

    public resolveExecution(
        payload: ExecutionTestPayload | EOTTestPayload,
        runInstance: TestRun,
        deferredTillEOT: Deferred<void>,
    ): Promise<void> {
        if (payload !== undefined && 'eot' in payload) {
            // the payload is an EOT payload, so resolve the deferred promise.
            traceLog('ResultResolver EOT received for execution.');
            const eotPayload = payload as EOTTestPayload;
            if (eotPayload.eot === true) {
                deferredTillEOT.resolve();
                return Promise.resolve();
            }
        }
        return this._resolveExecution(payload as ExecutionTestPayload, runInstance);
    }

    public _resolveExecution(payload: ExecutionTestPayload, runInstance: TestRun): Promise<void> {
        const rawTestExecData = payload as ExecutionTestPayload;
        if (rawTestExecData !== undefined && rawTestExecData.result !== undefined) {
            // Map which holds the subtest information for each test item.

            // iterate through payload and update the UI accordingly.
            for (const keyTemp of Object.keys(rawTestExecData.result)) {
                const testCases: TestItem[] = [];

                // grab leaf level test items
                this.testController.items.forEach((i) => {
                    const tempArr: TestItem[] = getTestCaseNodes(i);
                    testCases.push(...tempArr);
                });

                if (rawTestExecData.result[keyTemp].outcome === 'error') {
                    const rawTraceback = rawTestExecData.result[keyTemp].traceback ?? '';
                    const traceback = splitLines(rawTraceback, {
                        trim: false,
                        removeEmptyEntries: true,
                    }).join('\r\n');
                    const text = `${rawTestExecData.result[keyTemp].test} failed with error: ${
                        rawTestExecData.result[keyTemp].message ?? rawTestExecData.result[keyTemp].outcome
                    }\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    // search through freshly built array of testItem to find the failed test and update UI.
                    testCases.forEach((indiItem) => {
                        if (indiItem.id === grabVSid) {
                            if (indiItem.uri && indiItem.range) {
                                message.location = new Location(indiItem.uri, indiItem.range);
                                runInstance.errored(indiItem, message);
                                runInstance.appendOutput(fixLogLines(text));
                            }
                        }
                    });
                } else if (
                    rawTestExecData.result[keyTemp].outcome === 'failure' ||
                    rawTestExecData.result[keyTemp].outcome === 'passed-unexpected'
                ) {
                    const rawTraceback = rawTestExecData.result[keyTemp].traceback ?? '';
                    const traceback = splitLines(rawTraceback, {
                        trim: false,
                        removeEmptyEntries: true,
                    }).join('\r\n');

                    const text = `${rawTestExecData.result[keyTemp].test} failed: ${
                        rawTestExecData.result[keyTemp].message ?? rawTestExecData.result[keyTemp].outcome
                    }\r\n${traceback}\r\n`;
                    const message = new TestMessage(text);

                    // note that keyTemp is a runId for unittest library...
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    // search through freshly built array of testItem to find the failed test and update UI.
                    testCases.forEach((indiItem) => {
                        if (indiItem.id === grabVSid) {
                            if (indiItem.uri && indiItem.range) {
                                message.location = new Location(indiItem.uri, indiItem.range);
                                runInstance.failed(indiItem, message);
                                runInstance.appendOutput(fixLogLines(text));
                            }
                        }
                    });
                } else if (
                    rawTestExecData.result[keyTemp].outcome === 'success' ||
                    rawTestExecData.result[keyTemp].outcome === 'expected-failure'
                ) {
                    const grabTestItem = this.runIdToTestItem.get(keyTemp);
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    if (grabTestItem !== undefined) {
                        testCases.forEach((indiItem) => {
                            if (indiItem.id === grabVSid) {
                                if (indiItem.uri && indiItem.range) {
                                    runInstance.passed(grabTestItem);
                                }
                            }
                        });
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'skipped') {
                    const grabTestItem = this.runIdToTestItem.get(keyTemp);
                    const grabVSid = this.runIdToVSid.get(keyTemp);
                    if (grabTestItem !== undefined) {
                        testCases.forEach((indiItem) => {
                            if (indiItem.id === grabVSid) {
                                if (indiItem.uri && indiItem.range) {
                                    runInstance.skipped(grabTestItem);
                                }
                            }
                        });
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'subtest-failure') {
                    // split on " " since the subtest ID has the parent test ID in the first part of the ID.
                    const parentTestCaseId = keyTemp.split(' ')[0];
                    const subtestId = keyTemp.split(' ')[1];
                    const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);
                    const data = rawTestExecData.result[keyTemp];
                    // find the subtest's parent test item
                    if (parentTestItem) {
                        const subtestStats = this.subTestStats.get(parentTestCaseId);
                        if (subtestStats) {
                            subtestStats.failed += 1;
                        } else {
                            this.subTestStats.set(parentTestCaseId, { failed: 1, passed: 0 });
                            runInstance.appendOutput(fixLogLines(`${parentTestCaseId} [subtests]:\r\n`));
                            // clear since subtest items don't persist between runs
                            clearAllChildren(parentTestItem);
                        }
                        const subTestItem = this.testController?.createTestItem(subtestId, subtestId);
                        runInstance.appendOutput(fixLogLines(`${subtestId} Failed\r\n`));
                        // create a new test item for the subtest
                        if (subTestItem) {
                            const traceback = data.traceback ?? '';
                            const text = `${data.subtest} Failed: ${data.message ?? data.outcome}\r\n${traceback}\r\n`;
                            runInstance.appendOutput(fixLogLines(text));
                            parentTestItem.children.add(subTestItem);
                            runInstance.started(subTestItem);
                            const message = new TestMessage(rawTestExecData?.result[keyTemp].message ?? '');
                            if (parentTestItem.uri && parentTestItem.range) {
                                message.location = new Location(parentTestItem.uri, parentTestItem.range);
                            }
                            runInstance.failed(subTestItem, message);
                        } else {
                            throw new Error('Unable to create new child node for subtest');
                        }
                    } else {
                        throw new Error('Parent test item not found');
                    }
                } else if (rawTestExecData.result[keyTemp].outcome === 'subtest-success') {
                    // split only on first " [" since the subtest ID has the parent test ID in the first part of the ID.
                    const index = keyTemp.indexOf(' [');
                    const parentTestCaseId = keyTemp.substring(0, index);
                    // add one to index to remove the space from the start of the subtest ID
                    const subtestId = keyTemp.substring(index + 1, keyTemp.length);
                    const parentTestItem = this.runIdToTestItem.get(parentTestCaseId);

                    // find the subtest's parent test item
                    if (parentTestItem) {
                        const subtestStats = this.subTestStats.get(parentTestCaseId);
                        if (subtestStats) {
                            subtestStats.passed += 1;
                        } else {
                            this.subTestStats.set(parentTestCaseId, { failed: 0, passed: 1 });
                            runInstance.appendOutput(fixLogLines(`${parentTestCaseId} [subtests]:\r\n`));
                            // clear since subtest items don't persist between runs
                            clearAllChildren(parentTestItem);
                        }
                        const subTestItem = this.testController?.createTestItem(subtestId, subtestId);
                        // create a new test item for the subtest
                        if (subTestItem) {
                            parentTestItem.children.add(subTestItem);
                            runInstance.started(subTestItem);
                            runInstance.passed(subTestItem);
                            runInstance.appendOutput(fixLogLines(`${subtestId} Passed\r\n`));
                        } else {
                            throw new Error('Unable to create new child node for subtest');
                        }
                    } else {
                        throw new Error('Parent test item not found');
                    }
                }
            }
        }
        return Promise.resolve();
    }
}
