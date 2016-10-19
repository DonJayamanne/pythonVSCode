//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
// Place this right on top
import { initialize } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as vscode from 'vscode';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { JupyterClientAdapter } from '../client/jupyter/jupyter_client/main';
import * as mocks from './mockClasses';
import { KernelManagerImpl } from '../client/jupyter/kernel-manager';

suiteSetup(done => {
    initialize().then(() => {
        done();
    });
});

// Defines a Mocha test suite to group tests of similar kind together
suite('Kernel Manager', () => {
    test('GetAllKernelSpecsFor python', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        const cmds = (vscode.commands as any);
        const oldRegisterCommand = vscode.commands.registerCommand;
        // Hack hack hack hack hack :)
        cmds.registerCommand = function () { };
        const mgr = new KernelManagerImpl(output, jupyter);
        cmds.registerCommand = oldRegisterCommand;
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Start a kernel', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        const cmds = (vscode.commands as any);
        const oldRegisterCommand = vscode.commands.registerCommand;
        // Hack hack hack hack hack :)
        cmds.registerCommand = function () { };
        const mgr = new KernelManagerImpl(output, jupyter);
        cmds.registerCommand = oldRegisterCommand;
        mgr.getAllKernelSpecsFor('python').then(specMetadata => {
            assert.notEqual(specMetadata.length, 0, 'No spec metatadata');
            return mgr.startKernel(specMetadata[0], 'python');
        }).then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Start any kernel for Python', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        const cmds = (vscode.commands as any);
        const oldRegisterCommand = vscode.commands.registerCommand;
        // Hack hack hack hack hack :)
        cmds.registerCommand = function () { };
        const mgr = new KernelManagerImpl(output, jupyter);
        cmds.registerCommand = oldRegisterCommand;
        mgr.startKernelFor('python').then(kernel => {
            assert.equal(typeof kernel === 'object' && kernel !== null, true, 'Kernel instance not returned');
            done();
        }).catch(reason => {
            assert.fail(reason, null, 'Some error', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
});