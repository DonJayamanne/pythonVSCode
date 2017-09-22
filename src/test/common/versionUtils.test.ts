import * as assert from 'assert';
import { VersionUtils } from '../../client/common/versionUtils';

suite('Version Utils', () => {
    test('Must handle invalid versions', async () => {
        const version = 'ABC';
        assert.equal(VersionUtils.convertToSemver(version), `${version}.0.0`, 'Version is incorrect');
    });
    test('Must handle null, empty and undefined', async () => {
        assert.equal(VersionUtils.convertToSemver(''), '0.0.0', 'Version is incorrect for empty string');
        assert.equal(VersionUtils.convertToSemver(<any>null), '0.0.0', 'Version is incorrect for null value');
        assert.equal(VersionUtils.convertToSemver(<any>undefined), '0.0.0', 'Version is incorrect for undefined value');
    });
    test('Must be able to compare versions correctly', async () => {
        assert.equal(VersionUtils.compareVersion('', '1'), 0, '1. Comparison failed');
        assert.equal(VersionUtils.compareVersion('1', '0.1'), 1, '2. Comparison failed');
        assert.equal(VersionUtils.compareVersion('2.10', '2.9'), 1, '3. Comparison failed');
        assert.equal(VersionUtils.compareVersion('2.99.9', '3'), 0, '4. Comparison failed');
    });
});
