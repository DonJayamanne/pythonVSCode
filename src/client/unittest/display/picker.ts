import {QuickPickItem, window} from 'vscode';
import * as vscode from 'vscode';
import {Tests, TestsToRun, TestFolder, TestFile, TestFunction, TestSuite, FlattenedTestFunction, TestStatus} from '../common/contracts';
import {getDiscoveredTests} from '../common/testUtils';
import * as constants from '../../common/constants';

export class TestDisplay {
    constructor() {
    }
    public displayTestUI() {
        const tests = getDiscoveredTests();
        window.showQuickPick(buildItems(tests), { matchOnDescription: true, matchOnDetail: true }).then(onItemSelected);
    }
}

enum Type {
    RunAll = 0,
    ReDiscover = 1,
    RunFailed = 2,
    RunFolder = 3,
    RunFile = 4,
    RunClass = 5,
    RunMethod = 6,
    ViewTestOutput = 7
}
const statusIconMapping = new Map<TestStatus, string>();
statusIconMapping.set(TestStatus.Pass, constants.Octicon_Test_Pass);
statusIconMapping.set(TestStatus.Fail, constants.Octicon_Test_Fail);
statusIconMapping.set(TestStatus.Error, constants.Octicon_Test_Error);
statusIconMapping.set(TestStatus.Skipped, constants.Octicon_Test_Skip);

interface TestItem extends QuickPickItem {
    type: Type;
    fn?: FlattenedTestFunction;
}
function getSummary(tests?: Tests) {
    if (!tests || !tests.summary) {
        return '';
    }
    const statusText = [];
    if (tests.summary.passed > 0) {
        statusText.push(`${constants.Octicon_Test_Pass} ${tests.summary.passed} Passed`);
    }
    if (tests.summary.failures > 0) {
        statusText.push(`${constants.Octicon_Test_Fail} ${tests.summary.failures} Failed`);
    }
    if (tests.summary.errors > 0) {
        const plural = tests.summary.errors === 1 ? '' : 's';
        statusText.push(`${constants.Octicon_Test_Error} ${tests.summary.errors} Error` + plural);
    }
    if (tests.summary.skipped > 0) {
        statusText.push(`${constants.Octicon_Test_Skip} ${tests.summary.skipped} Skipped`);
    }
    return statusText.join(', ').trim();
}
function buildItems(tests?: Tests): TestItem[] {
    const items: TestItem[] = [];
    items.push({ description: '', label: 'Run All Tests', type: Type.RunAll });
    items.push({ description: '', label: 'Rediscover Tests', type: Type.ReDiscover });
    items.push({ description: '', label: 'View Test Output', type: Type.ViewTestOutput, detail: getSummary(tests) });

    if (!tests) {
        return items;
    }

    if (tests.summary.failures > 0) {
        items.push({ description: '', label: 'Run Failed Tests', type: Type.RunFailed, detail: `${constants.Octicon_Test_Fail} ${tests.summary.failures} Failed` });
    }

    let functionItems: TestItem[] = [];
    tests.testFunctions.forEach(fn => {
        const classPrefix = fn.parentTestSuite ? fn.parentTestSuite.name + '.' : '';
        functionItems.push({
            description: '',
            detail: fn.parentTestFile.name,
            label: fn.testFunction.name,
            type: Type.RunMethod,
            fn: fn
        });
    });
    functionItems.sort((a, b) => {
        if (a.detail + a.label < b.detail + b.label) {
            return -1;
        }
        if (a.detail + a.label > b.detail + b.label) {
            return 1;
        }
        return 0;
    });

    items.push(...functionItems);
    return items;
}

function onItemSelected(selection: TestItem) {
    if (!selection || typeof selection.type !== 'number') {
        return;
    }
    let cmd = '';
    let args = [];
    switch (selection.type) {
        case Type.RunAll: {
            cmd = constants.Command_Tests_Run;
            break;
        }
        case Type.ReDiscover: {
            cmd = constants.Command_Tests_Discover;
            break;
        }
        case Type.ViewTestOutput: {
            cmd = constants.Command_Tests_ViewOutput;
            break;
        }
        case Type.RunFailed: {
            cmd = constants.Command_Tests_Run_Failed;
            break;
        }
        case Type.RunMethod: {
            cmd = constants.Command_Tests_Run;
            args.push(selection.fn);
            break;
        }
    }

    vscode.commands.executeCommand(cmd, ...args);
}