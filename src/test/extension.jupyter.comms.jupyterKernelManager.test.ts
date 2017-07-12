//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
// Place this right on top
import { initialize, IS_TRAVIS, TEST_TIMEOUT, setPythonExecutable } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { JupyterClientAdapter } from '../client/jupyter/jupyter_client/main';
import { KernelManagerImpl } from '../client/jupyter/kernel-manager';
import * as settings from '../client/common/configSettings';

let pythonSettings = settings.PythonSettings.getInstance();
const disposable = setPythonExecutable(pythonSettings);

export class MockOutputChannel implements vscode.OutputChannel {
    constructor(name: string) {
        this.name = name;
        this.output = '';
        this.timeOut = setTimeout(() => {
            console.log(this.output);
            this.writeToConsole = true;
            this.timeOut = null;
        }, TEST_TIMEOUT - 1000);
    }
    private timeOut: number;
    name: string;
    output: string;
    isShown: boolean;
    private writeToConsole: boolean;
    append(value: string) {
        this.output += value;
        if (this.writeToConsole) {
            console.log(value);
        }
    }
    appendLine(value: string) {
        this.append(value); this.append('\n');
        if (this.writeToConsole) {
            console.log(value);
            console.log('\n');
        }
    }
    clear() { }
    show(preservceFocus?: boolean): void;
    show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    show(x?: any, y?: any): void {
        this.isShown = true;
    }
    hide() {
        this.isShown = false;
    }
    dispose() {
        if (this.timeOut) {
            clearTimeout(this.timeOut);
            this.timeOut = null;
        }
    }
}

suite('Kernel Manager', () => {
    suiteSetup(done => {
        initialize().then(() => {
            done();
        });
    });
    suiteTeardown(done => {
        disposable.dispose();
    });
    setup(() => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        process.env['DEBUG_DJAYAMANNE_IPYTHON'] = '1';
        disposables = [];
        output = new MockOutputChannel('Jupyter');
        disposables.push(output);
        jupyter = new JupyterClientAdapter(output, __dirname);
        disposables.push(jupyter);
        // Hack hack hack hack hack :)
        cmds.registerCommand = function () { };
    });
    teardown(() => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
        process.env['DEBUG_DJAYAMANNE_IPYTHON'] = '0';
        output.dispose();
        jupyter.dispose();
        disposables.forEach(d => {
            try {
                d.dispose();
            } catch (error) {
            }
        });
        cmds.registerCommand = oldRegisterCommand;
    });

    let output: MockOutputChannel;
    let jupyter: JupyterClientAdapter;
    let disposables: { dispose: Function }[];
    const cmds = (vscode.commands as any);
    const oldRegisterCommand = vscode.commands.registerCommand;

    test('GetAllKernelSpecsFor python', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
    });
    test('Start a kernel', done => {
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            return mgr.startKernel(specMetadata[0], 'python');
        }).then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
    });
    test('Start any kernel for Python', done => {
        const mgr = new KernelManagerImpl(output, jupyter);
        disposables.push(mgr);
        mgr.startKernelFor('python').then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
            done();
        });
    });
});