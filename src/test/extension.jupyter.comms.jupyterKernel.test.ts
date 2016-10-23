//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//
// Place this right on top
import { initialize } from './initialize';
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { JupyterClientAdapter } from '../client/jupyter/jupyter_client/main';
import * as mocks from './mockClasses';
import { KernelRestartedError, KernelShutdownError } from '../client/jupyter/common/errors';
import { createDeferred } from '../client/common/helpers';
import { JupyterClientKernel } from '../client/jupyter/jupyter_client-Kernel';
import { KernelspecMetadata } from '../client/jupyter/contracts';

suiteSetup(done => {
    initialize().then(() => {
        done();
    });
});

// Defines a Mocha test suite to group tests of similar kind together
suite('Jupyter Kernel', () => {
    test('Start and Shutdown Kernel', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            return kernel.shutdown();
        }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to start Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Restart Kernel', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            return kernel.shutdown(true);
        }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to restart Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Interrupt Kernel', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            return kernel.interrupt();
        }).then(() => {
            done();
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Execute Code (success)', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            kernel.execute('1+2').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Execute Code (with threads)', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            kernel.execute('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout (2) not found in output');
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'stdout (3) not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Execute Code (failure)', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            kernel.execute('print(x)').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
                done();
            }, () => {
                assert.equal(output.some(d => d.stream === 'error' && d.type === 'text'), true, 'error not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'error'), true, 'status not found in output');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Shutdown while executing code', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;
        let kernelUUID: string;
        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            kernelUUID = startInfo[0];
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            let runFailedWithError = false;
            kernel.execute('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);
                if (output.length === 1) {
                    // Shutdown this kernel immediately
                    jupyter.shutdownkernel(kernelUUID).then(() => {
                        assert.equal(runFailedWithError, true, 'Error event not raised in observale');
                        done();
                    }, reason => {
                        assert.fail(reason, null, 'Failed to shutdown the kernel', '');
                    });
                }
            }, reason => {
                if (reason instanceof KernelShutdownError) {
                    runFailedWithError = true;
                }
                else {
                    assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
                }
            }, () => {
                assert.fail('Complete event fired', 'none', 'Completed fired for observable', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Interrupt Kernel while executing code', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;
        let kernelUUID: string;
        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            kernelUUID = startInfo[0];
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            jupyter.runCode('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output.push(data);

                if (output.length === 1) {
                    // interrupt this kernel immediately
                    jupyter.interruptKernel(kernelUUID).then(() => {
                        // Do nothing
                    }, reason => {
                        assert.fail(reason, null, 'Failed to interrupt the kernel', '');
                    });
                }
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter with invalid error', '');
            }, () => {
                assert.equal(output.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout not found in output');
                assert.equal(output.some(d => d.stream === 'error' && d.type === 'text'), true, 'error (KeyboardInterrupt) not found');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'error'), true, 'status not found in output');
                jupyter.dispose();
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Restart Kernel while executing code', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;
        let kernelUUID: string;
        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            kernelUUID = startInfo[0];
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output1 = [];
            const output2 = [];
            const output3 = [];
            const def1 = createDeferred<any>();
            const def2 = createDeferred<any>();
            const def3 = createDeferred<any>();
            kernel.execute('1+2').subscribe(data => {
                output1.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output1.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output1.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def1.resolve();
            });
            kernel.execute('print(2)\nimport time\ntime.sleep(5)\nprint(3)').subscribe(data => {
                output2.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output2.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '2'), true, 'stdout (2) not found in output');
                assert.equal(output2.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'stdout (3) not found in output');
                assert.equal(output2.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def2.resolve();
            });
            kernel.execute('print(1)').subscribe(data => {
                output3.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output3.some(d => d.stream === 'stdout' && d.type === 'text' && d.data['text/plain'] === '1'), true, 'pyout not found in output');
                assert.equal(output3.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                def3.resolve();
            });

            Promise.all([def1.promise, def2.promise, def3.promise]).then(() => {
                done();
            }).catch(reason => {
                assert.fail(reason, null, 'One of the code executions failed', '');
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
    test('Status Change', done => {
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '0';
        const output = new mocks.MockOutputChannel('Jupyter');
        const jupyter = new JupyterClientAdapter(output, __dirname);
        let selectedKernelSpec: KernelspecMetadata;

        jupyter.getAllKernelSpecs().then(kernelSpecs => {
            const kernelNames = Object.keys(kernelSpecs);
            assert.notEqual(kernelNames.length, 0, 'kernelSpecs not found');
            selectedKernelSpec = kernelSpecs[kernelNames[0]].spec;
            return jupyter.startKernel(selectedKernelSpec);
        }).then(startInfo => {
            const kernel = new JupyterClientKernel(selectedKernelSpec, 'python', startInfo[1], startInfo[2], startInfo[0], jupyter);
            const output = [];
            const statuses = [];
            kernel.onStatusChange(info => {
                statuses.push(info[1]);
            });
            kernel.execute('1+2').subscribe(data => {
                output.push(data);
            }, reason => {
                assert.fail(reason, null, 'Code execution failed in jupyter', '');
            }, () => {
                assert.equal(output.some(d => d.stream === 'pyout' && d.type === 'text' && d.data['text/plain'] === '3'), true, 'pyout not found in output');
                assert.equal(output.some(d => d.stream === 'status' && d.type === 'text' && d.data === 'ok'), true, 'status not found in output');
                assert.equal(statuses.indexOf('busy'), 0, 'busy status not the first status');
                assert.equal(statuses.indexOf('idle'), 1, 'idle status not the last status');
                done();
            });
        }).catch(reason => {
            assert.fail(reason, undefined, 'Failed to interrupt Kernel', '');
        });
        process.env['PYTHON_DONJAYAMANNE_TEST'] = '1';
    });
});