'use strict';
import {createTemporaryFile} from '../../common/helpers';
import {OutputChannel, CancellationToken} from 'vscode';
import {TestsToRun, Tests} from '../common/contracts';
import {updateResults} from '../common/testUtils';
import {updateResultsFromXmlLogFile, PassCalculationFormulae} from '../common/xUnitParser';
import {run} from '../common/runner';
import {PythonSettings} from '../../common/configSettings';

const pythonSettings = PythonSettings.getInstance();

export function runTest(rootDirectory: string, tests: Tests, args: string[], testsToRun?: TestsToRun, token?: CancellationToken, outChannel?: OutputChannel): Promise<any> {
    let testPaths = [];
    if (testsToRun && testsToRun.testFolder) {
        testPaths = testPaths.concat(testsToRun.testFolder.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFile) {
        testPaths = testPaths.concat(testsToRun.testFile.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testSuite) {
        testPaths = testPaths.concat(testsToRun.testSuite.map(f => f.nameToRun));
    }
    if (testsToRun && testsToRun.testFunction) {
        testPaths = testPaths.concat(testsToRun.testFunction.map(f => f.nameToRun));
    }

    let xmlLogFile = '';
    let xmlLogFileCleanup: Function = null;

    return createTemporaryFile('.xml').then(xmlLogResult => {
        xmlLogFile = xmlLogResult.filePath;
        xmlLogFileCleanup = xmlLogResult.cleanupCallback;
        return run(pythonSettings.unitTest.nosetestPath, args.concat(['--with-xunit', `--xunit-file=${xmlLogFile}`]).concat(testPaths), rootDirectory, token, outChannel);
    }).then(() => {
        return updateResultsFromLogFiles(tests, xmlLogFile);
    }).then(result => {
        xmlLogFileCleanup();
        return result;
    }).catch(reason => {
        xmlLogFileCleanup();
        return Promise.reject(reason);
    });
}

export function updateResultsFromLogFiles(tests: Tests, outputXmlFile: string): Promise<any> {
    return updateResultsFromXmlLogFile(tests, outputXmlFile, PassCalculationFormulae.nosetests).then(() => {
        updateResults(tests);
        return tests;
    });
}
