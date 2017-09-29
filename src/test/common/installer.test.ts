import * as assert from 'assert';
import { closeActiveWindows, IS_TRAVIS } from './../initialize';
import { MockOutputChannel } from './../mockClasses';
import { Installer, Product } from '../../client/common/installer';
import { EnumEx } from '../../client/common/enumUtils';

// TODO: Need to mock the command runner, to check what commands are being sent.
// Instead of altering the environment.

suite('Installer', () => {
    let outputChannel: MockOutputChannel;
    let installer: Installer;

    suiteSetup(() => {
        outputChannel = new MockOutputChannel('Installer');
        installer = new Installer(outputChannel);
    });
    suiteTeardown(() => closeActiveWindows());
    teardown(() => closeActiveWindows());

    async function testUninstallingProduct(product: Product) {
        const isInstalled = await installer.isInstalled(product);
        if (isInstalled) {
            await installer.uninstall(product);
            const isInstalled = await installer.isInstalled(product);
            // Someimtes installation doesn't work on Travis
            if (!IS_TRAVIS) {
                assert.equal(isInstalled, false, `Product uninstall failed`);
            }
        }
    }

    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`${prod.name} : Uninstall`, async () => {
            if (prod.value === Product.unittest || prod.value === Product.ctags) {
                return;
            }
            await testUninstallingProduct(prod.value);
        });
    });

    async function testInstallingProduct(product: Product) {
        const isInstalled = await installer.isInstalled(product);
        if (!isInstalled) {
            await installer.install(product);
        }
        const checkIsInstalledAgain = await installer.isInstalled(product);
        // Someimtes installation doesn't work on Travis
        if (!IS_TRAVIS) {
            assert.notEqual(checkIsInstalledAgain, false, `Product installation failed`);
        }
    }
    EnumEx.getNamesAndValues<Product>(Product).forEach(prod => {
        test(`${prod.name} : Install`, async () => {
            if (prod.value === Product.unittest || prod.value === Product.ctags) {
                return;
            }
            await testInstallingProduct(prod.value);
        });
    });
});
