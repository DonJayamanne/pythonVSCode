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
import * as vscode from 'vscode';
import { createDeferred, Deferred } from '../client/common/helpers';

// Defines a Mocha test suite to group tests of similar kind together
suite('Deferred', () => {
    test('Resolve', done => {
        const valueToSent = new Date().getTime();
        const def = createDeferred<number>();
        def.promise.then(value=>{
            assert.equal(value, valueToSent);
            assert.equal(def.resolved, true, 'resolved property value is not `true`');
            done();
        }).catch(reason=>{
            assert.fail(reason,'value', 'Was expecting promise to resolve, however it got rejected', '');
            assert.equal(def.rejected, true, 'resolved property value is not `true`');
            done();
        });

        assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
        assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
        assert.equal(def.completed, false, 'Promise is completed even when it should not be');

        def.resolve(valueToSent);

        assert.equal(def.resolved, true, 'Promise is not resolved even when it should not be');
        assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
        assert.equal(def.completed, true, 'Promise is not completed even when it should not be');
    });
    test('Reject', done => {
        const errorToSend = new Error('Something');
        const def = createDeferred<number>();
        def.promise.then(value=>{
            assert.fail( value,'Error', 'Was expecting promise to get rejected, however it was resolved', '');
            done();
        }).catch(reason=>{
            assert.equal(reason, errorToSend, 'Error received is not the same');
            done();
        });

        assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
        assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
        assert.equal(def.completed, false, 'Promise is completed even when it should not be');

        def.reject(errorToSend);

        assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
        assert.equal(def.rejected, true, 'Promise is not rejected even when it should not be');
        assert.equal(def.completed, true, 'Promise is not completed even when it should not be');
    });
});