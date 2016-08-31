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
    public displayFunctionTestPickerUI(fileName: string, testFunctions: TestFunction[]) {
        const tests = getDiscoveredTests();
        if (!tests) {
            return;
        }
        const testFile = tests.testFiles.find(file => file.name === fileName || file.fullPath === fileName);
        if (!testFile) {
            return;
        }
        const flattenedFunctions = tests.testFunctions.filter(fn => {
            return fn.parentTestFile.name === testFile.name &&
                testFunctions.some(testFunc => testFunc.nameToRun === fn.testFunction.nameToRun);
        });

        window.showQuickPick(buildItemsForFunctions(flattenedFunctions), { matchOnDescription: true, matchOnDetail: true }).then(onItemSelected);
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
statusIconMapping.set(TestStatus.Pass, constants.Octicons.Test_Pass);
statusIconMapping.set(TestStatus.Fail, constants.Octicons.Test_Fail);
statusIconMapping.set(TestStatus.Error, constants.Octicons.Test_Error);
statusIconMapping.set(TestStatus.Skipped, constants.Octicons.Test_Skip);

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
        statusText.push(`${constants.Octicons.Test_Pass} ${tests.summary.passed} Passed`);
    }
    if (tests.summary.failures > 0) {
        statusText.push(`${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed`);
    }
    if (tests.summary.errors > 0) {
        const plural = tests.summary.errors === 1 ? '' : 's';
        statusText.push(`${constants.Octicons.Test_Error} ${tests.summary.errors} Error` + plural);
    }
    if (tests.summary.skipped > 0) {
        statusText.push(`${constants.Octicons.Test_Skip} ${tests.summary.skipped} Skipped`);
    }
    return statusText.join(', ').trim();
}
function buildItems(tests?: Tests): TestItem[] {
    const items: TestItem[] = [];
    items.push({ description: '', label: 'Run All Tests', type: Type.RunAll });
    items.push({ description: '', label: 'Rediscover Tests', type: Type.ReDiscover });
    const summary = getSummary(tests);

    // Add an empty space because we'd like a separtor between actions and tests
    items.push({ description: '', label: 'View Test Output', type: Type.ViewTestOutput, detail: summary.length === 0 && tests ? '  ' : summary });

    if (!tests) {
        return items;
    }

    if (tests.summary.failures > 0) {
        items.push({ description: '', label: 'Run Failed Tests', type: Type.RunFailed, detail: `${constants.Octicons.Test_Fail} ${tests.summary.failures} Failed` });
    }

    let functionItems = buildItemsForFunctions(tests.testFunctions);
    items.push(...functionItems);
    return items;
}

function buildItemsForFunctions(tests: FlattenedTestFunction[]): TestItem[] {
    let functionItems: TestItem[] = [];
    tests.forEach(fn => {
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
    return functionItems;
}
function onItemSelected(selection: TestItem) {
    if (!selection || typeof selection.type !== 'number') {
        return;
    }
    let cmd = '';
    let args = [];
    switch (selection.type) {
        case Type.RunAll: {
            cmd = constants.Commands.Tests_Run;
            break;
        }
        case Type.ReDiscover: {
            cmd = constants.Commands.Tests_Discover;
            break;
        }
        case Type.ViewTestOutput: {
            cmd = constants.Commands.Tests_ViewOutput;
            break;
        }
        case Type.RunFailed: {
            cmd = constants.Commands.Tests_Run_Failed;
            break;
        }
        case Type.RunMethod: {
            cmd = constants.Commands.Tests_Run;
            args.push(selection.fn);
            break;
        }
    }

    vscode.commands.executeCommand(cmd, ...args);
}