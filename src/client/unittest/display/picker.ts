import {QuickPickItem, window} from 'vscode';
import * as vscode from 'vscode';
import {Tests, TestsToRun, TestFolder, TestFile, TestFunction, TestSuite, FlattenedTestFunction} from '../contracts';
import {getDiscoveredTests} from '../testUtils';

export class TestDisplay {
    constructor() {
    }
    public displayTestUI() {
        const tests = getDiscoveredTests();
        displayUI(tests);
    }
}
function displayUI(tests?: Tests) {
    window.showQuickPick(buildItems(tests), { matchOnDescription: true, matchOnDetail: true }).then(onItemSelected);
}

enum Type {
    RunAll = 0,
    ReDiscover = 1,
    RunFailed = 2,
    RunFolder = 3,
    RunFile = 4,
    RunClass = 5,
    RunMethod = 6
}
interface TestItem extends QuickPickItem {
    type: Type;
    fn?: FlattenedTestFunction;
}
function buildItems(tests?: Tests): TestItem[] {
    const items: TestItem[] = [];
    items.push({ description: 'Run All Tests', label: 'Run All Tests', type: Type.RunAll });
    items.push({ description: 'Rediscover unit tests', label: 'Rediscover Tests', type: Type.ReDiscover });

    if (!tests) {
        return items;
    }

    if (tests.testFunctions.some(fn => fn.testFunction.passed === false)) {
        items.push({ description: 'Run failed tests only', label: 'Run Failed Tests', type: Type.RunFailed });
    }

    let functionItems: TestItem[] = [];
    tests.testFunctions.forEach(fn => {
        const classPrefix = fn.parentTestSuite ? fn.parentTestSuite.name + '.' : '';
        functionItems.push({
            description: '',
            detail: fn.parentTestFile.name,
            label: classPrefix + fn.testFunction.name,
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
            cmd = 'python.runtests';
            break;
        }
        case Type.ReDiscover: {
            cmd = 'python.discoverTests';
            break;
        }
        case Type.RunFailed: {
            cmd = 'python.runFailedTests';
            break;
        }
        case Type.RunMethod: {
            cmd = 'python.runtests';
            args.push(selection.fn);
            break;
        }
    }

    vscode.commands.executeCommand(cmd, ...args);
}