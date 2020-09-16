// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { clearCache, InMemoryCache } from '../../../client/common/utils/cacheUtils';

type CacheUtilsTestScenario = {
    scenarioDesc: string;
    // tslint:disable-next-line:no-any
    dataToStore: any;
};

const scenariosToTest: CacheUtilsTestScenario[] = [
    {
        scenarioDesc: 'simple string',
        dataToStore: 'hello'
    },
    {
        scenarioDesc: 'undefined',
        dataToStore: undefined
    },
    {
        scenarioDesc: 'object',
        dataToStore: { date: new Date(), hello: 1234 }
    }
];

// tslint:disable:no-any max-func-body-length
suite('Common Utils - CacheUtils', () => {
    suite('InMemory Cache', () => {
        let clock: sinon.SinonFakeTimers;
        setup(() => {
            clock = sinon.useFakeTimers();
        });
        teardown(() => {
            clock.restore();
            clearCache();
        });
        test('Cached item should exist', () => {
            const cache = new InMemoryCache(5_000);
            cache.data = 'Hello World';

            assert.equal(cache.data, 'Hello World');
            assert.isOk(cache.hasData);
        });
        test('Cached item can be updated and should exist', () => {
            const cache = new InMemoryCache(5_000);
            cache.data = 'Hello World';

            assert.equal(cache.data, 'Hello World');
            assert.isOk(cache.hasData);

            cache.data = 'Bye';

            assert.equal(cache.data, 'Bye');
            assert.isOk(cache.hasData);
        });
        test('Cached item should not exist after time expires', () => {
            const cache = new InMemoryCache(5_000);
            cache.data = 'Hello World';

            assert.equal(cache.data, 'Hello World');
            assert.isTrue(cache.hasData);

            // Should not expire after 4.999s.
            clock.tick(4_999);

            assert.equal(cache.data, 'Hello World');
            assert.isTrue(cache.hasData);

            // Should expire after 5s (previous 4999ms + 1ms).
            clock.tick(1);

            assert.equal(cache.data, undefined);
            assert.isFalse(cache.hasData);
        });
    });
    suite('Interpreter Specific Cache', () => {
        let clock: sinon.SinonFakeTimers;
        setup(() => {
            clock = sinon.useFakeTimers();
        });
        teardown(() => {
            clock.restore();
            clearCache();
        });
        scenariosToTest.forEach((scenario: CacheUtilsTestScenario) => {
            test(`Data is stored in cache: ${scenario.scenarioDesc}`, () => {
                const cache = new InMemoryCache(10000, 'Something');

                expect(cache.hasData).to.be.equal(false, 'Must not have any data');

                cache.data = scenario.dataToStore;

                expect(cache.hasData).to.be.equal(true, 'Must have data');
                expect(cache.data).to.be.deep.equal(scenario.dataToStore);
            });
            test(`Data is stored in cache must be cleared when clearing globally: ${scenario.scenarioDesc}`, () => {
                const cache = new InMemoryCache(10000, 'Something');

                expect(cache.hasData).to.be.equal(false, 'Must not have any data');

                cache.data = scenario.dataToStore;

                expect(cache.hasData).to.be.equal(true, 'Must have data');
                expect(cache.data).to.be.deep.equal(scenario.dataToStore);

                clearCache();
                expect(cache.hasData).to.be.equal(false, 'Must not have data');
                expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
            });
            test(`Data is stored in cache must be cleared: ${scenario.scenarioDesc}`, () => {
                const cache = new InMemoryCache(10000, 'Something');

                expect(cache.hasData).to.be.equal(false, 'Must not have any data');

                cache.data = scenario.dataToStore;

                expect(cache.hasData).to.be.equal(true, 'Must have data');
                expect(cache.data).to.be.deep.equal(scenario.dataToStore);

                cache.clear();
                expect(cache.hasData).to.be.equal(false, 'Must not have data');
                expect(cache.data).to.be.deep.equal(undefined, 'Must not have data');
            });
            test(`Data is stored in cache and expired data is not returned: ${scenario.scenarioDesc}`, async () => {
                const cache = new InMemoryCache(100, 'Something');

                expect(cache.hasData).to.be.equal(false, 'Must not have any data before caching.');
                cache.data = scenario.dataToStore;
                expect(cache.hasData).to.be.equal(true, 'Must have data after setting the first time.');
                expect(cache.data).to.be.deep.equal(scenario.dataToStore);

                clock.tick(10);
                expect(cache.hasData).to.be.equal(true, 'Must have data after waiting for 10ms');
                expect(cache.data).to.be.deep.equal(
                    scenario.dataToStore,
                    'Data should be intact and unchanged in cache after 10ms'
                );

                clock.tick(50);
                expect(cache.hasData).to.be.equal(true, 'Must have data after waiting 50ms');
                expect(cache.data).to.be.deep.equal(
                    scenario.dataToStore,
                    'Data should be intact and unchanged in cache after 50ms'
                );

                clock.tick(110);
                expect(cache.hasData).to.be.equal(false, 'Must not have data after waiting 110ms');
                expect(cache.data).to.be.deep.equal(
                    undefined,
                    'Must not have data stored after 100ms timeout expires.'
                );
            });
            test(`Data is stored in cache and with same key points to the same data: ${scenario.scenarioDesc}`, () => {
                const cache = new InMemoryCache(10000, 'Something');
                const cache2 = new InMemoryCache(10000, 'Something');

                expect(cache.hasData).to.be.equal(false, 'Must not have any data');
                expect(cache2.hasData).to.be.equal(false, 'Must not have any data');

                cache.data = scenario.dataToStore;

                expect(cache.hasData).to.be.equal(true, 'Must have data');
                expect(cache2.hasData).to.be.equal(true, 'Must have data');
                expect(cache.data).to.be.deep.equal(scenario.dataToStore);
                expect(cache2.data).to.be.deep.equal(scenario.dataToStore);
            });
        });
    });
});
