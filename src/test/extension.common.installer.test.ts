//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
// Place this right on top
import { PYTHON_PATH, closeActiveWindows } from './initialize';
// The module \'assert\' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the \'vscode\' module
// as well as import your extension to test it
import * as settings from '../client/common/configSettings';
import { MockOutputChannel } from './mockClasses';
import { Installer, Product } from '../client/common/installer';
import { EnumEx } from '../client/common/enumUtils';

let pythonSettings = settings.PythonSettings.getInstance();

suite('Installer', () => {
    let outputChannel: MockOutputChannel;
    let installer: Installer;

    suiteSetup(() => {
        pythonSettings.pythonPath = PYTHON_PATH;
        outputChannel = new MockOutputChannel('Installer');
        installer = new Installer(outputChannel);
    });
    suiteTeardown(done => {
        closeActiveWindows().then(done, done);
    });
    teardown(done => {
        closeActiveWindows().then(done, done);
    });

    async function testUninstallingProduct(product: Product) {
        const isInstalled = await installer.isInstalled(product);
        if (isInstalled) {
            await installer.uninstall(product);
            const isInstalled = await installer.isInstalled(product);
            assert.equal(isInstalled, false, `Product uninstall failed`);
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
        assert.equal(checkIsInstalledAgain, true, `Product installation failed`);
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