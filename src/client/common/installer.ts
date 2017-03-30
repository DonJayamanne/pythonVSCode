import * as vscode from 'vscode';
import * as settings from './configSettings';
import { createDeferred, isNotInstalledError } from './helpers';
import { execPythonFile } from './utils';
import * as os from 'os';
import { Documentation } from './constants';

export enum Product {
    pytest,
    nosetest,
    pylint,
    flake8,
    pep8,
    pylama,
    prospector,
    pydocstyle,
    yapf,
    autopep8,
    mypy,
    unittest,
    ctags
}

const ProductInstallScripts = new Map<Product, string[]>();
ProductInstallScripts.set(Product.autopep8, ['-m', 'pip', 'install', 'autopep8']);
ProductInstallScripts.set(Product.flake8, ['-m', 'pip', 'install', 'flake8']);
ProductInstallScripts.set(Product.mypy, ['-m', 'pip', 'install', 'mypy-lang']);
ProductInstallScripts.set(Product.nosetest, ['-m', 'pip', 'install', 'nose']);
ProductInstallScripts.set(Product.pep8, ['-m', 'pip', 'install', 'pep8']);
ProductInstallScripts.set(Product.pylama, ['-m', 'pip', 'install', 'pylama']);
ProductInstallScripts.set(Product.prospector, ['-m', 'pip', 'install', 'prospector']);
ProductInstallScripts.set(Product.pydocstyle, ['-m', 'pip', 'install', 'pydocstyle']);
ProductInstallScripts.set(Product.pylint, ['-m', 'pip', 'install', 'pylint']);
ProductInstallScripts.set(Product.pytest, ['-m', 'pip', 'install', '-U', 'pytest']);
ProductInstallScripts.set(Product.yapf, ['-m', 'pip', 'install', 'yapf']);
switch (os.platform()) {
    case 'win32': {
        // Nothing
        break;
    }
    case 'darwin': {
        ProductInstallScripts.set(Product.ctags, ['brew install ctags']);
    }
    default: {
        ProductInstallScripts.set(Product.ctags, ['sudo apt-get install exuberant-ctags']);
    }
}

const Linters: Product[] = [Product.flake8, Product.pep8, Product.pylama, Product.prospector, Product.pylint, Product.mypy, Product.pydocstyle];
const Formatters: Product[] = [Product.autopep8, Product.yapf];
const TestFrameworks: Product[] = [Product.pytest, Product.nosetest, Product.unittest];

const ProductNames = new Map<Product, string>();
ProductNames.set(Product.autopep8, 'autopep8');
ProductNames.set(Product.flake8, 'flake8');
ProductNames.set(Product.mypy, 'mypy');
ProductNames.set(Product.nosetest, 'nosetest');
ProductNames.set(Product.pep8, 'pep8');
ProductNames.set(Product.pylama, 'pylama');
ProductNames.set(Product.prospector, 'prospector');
ProductNames.set(Product.pydocstyle, 'pydocstyle');
ProductNames.set(Product.pylint, 'pylint');
ProductNames.set(Product.pytest, 'py.test');
ProductNames.set(Product.yapf, 'yapf');

const SettingToDisableProduct = new Map<Product, string>();
SettingToDisableProduct.set(Product.autopep8, 'autopep8');
SettingToDisableProduct.set(Product.flake8, 'linting.flake8Enabled');
SettingToDisableProduct.set(Product.mypy, 'linting.mypyEnabled');
SettingToDisableProduct.set(Product.nosetest, 'unitTest.nosetestsEnabled');
SettingToDisableProduct.set(Product.pep8, 'linting.pep8Enabled');
SettingToDisableProduct.set(Product.pylama, 'linting.pylamaEnabled');
SettingToDisableProduct.set(Product.prospector, 'linting.prospectorEnabled');
SettingToDisableProduct.set(Product.pydocstyle, 'linting.pydocstyleEnabled');
SettingToDisableProduct.set(Product.pylint, 'linting.pylintEnabled');
SettingToDisableProduct.set(Product.pytest, 'unitTest.pyTestEnabled');
SettingToDisableProduct.set(Product.yapf, 'yapf');

export class Installer {
    private static terminal: vscode.Terminal;
    private disposables: vscode.Disposable[] = [];
    constructor(private outputChannel: vscode.OutputChannel = null) {
        this.disposables.push(vscode.window.onDidCloseTerminal(term => {
            if (term === Installer.terminal) {
                Installer.terminal = null;
            }
        }));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    promptToInstall(product: Product): Thenable<any> {
        let productType = Linters.indexOf(product) >= 0 ? 'Linter' : (Formatters.indexOf(product) >= 0 ? 'Formatter' : 'Test Framework');
        const productName = ProductNames.get(product);

        const installOption = 'Install ' + productName;
        const disableOption = 'Disable this ' + productType;
        const alternateFormatter = product === Product.autopep8 ? 'yapf' : 'autopep8';
        const useOtherFormatter = `Use '${alternateFormatter}' formatter`;
        const options = [];
        if (Formatters.indexOf(product) === -1) {
            options.push(...[installOption, disableOption]);
        }
        else {
            options.push(...[installOption, useOtherFormatter]);
        }
        return vscode.window.showErrorMessage(`${productType} ${productName} is not installed`, ...options).then(item => {
            switch (item) {
                case installOption: {
                    return this.installProduct(product);
                }
                case disableOption: {
                    if (Linters.indexOf(product) >= 0) {
                        return disableLinter(product);
                    }
                    else {
                        const pythonConfig = vscode.workspace.getConfiguration('python');
                        const settingToDisable = SettingToDisableProduct.get(product);
                        return pythonConfig.update(settingToDisable, false);
                    }
                }
                case useOtherFormatter: {
                    const pythonConfig = vscode.workspace.getConfiguration('python');
                    return pythonConfig.update('formatting.provider', alternateFormatter);
                }
                case 'Help': {
                    return Promise.resolve();
                }
            }
        });
    }

    installProduct(product: Product): Promise<any> {
        if (!this.outputChannel && !Installer.terminal) {
            Installer.terminal = vscode.window.createTerminal('Python Installer');
        }

        if (product === Product.ctags && os.platform() === 'win32') {
            vscode.commands.executeCommand('python.displayHelp', Documentation.Workspace.InstallOnWindows);
            return Promise.resolve();
        }

        let installArgs = ProductInstallScripts.get(product);
        let pipIndex = installArgs.indexOf('pip');
        if (pipIndex > 0) {
            installArgs = installArgs.slice();
            let proxy = vscode.workspace.getConfiguration('http').get('proxy', '');
            if (proxy.length > 0) {
                installArgs.splice(2, 0, proxy);
                installArgs.splice(2, 0, '--proxy');
            }
        }
        const pythonPath = settings.PythonSettings.getInstance().pythonPath;

        if (this.outputChannel && installArgs[0] === '-m') {
            // Errors are just displayed to the user
            this.outputChannel.show();
            return execPythonFile(pythonPath, installArgs, vscode.workspace.rootPath, true, (data) => {
                this.outputChannel.append(data);
            });
        }
        else {
            let installScript = installArgs.join(' ');
            if (installArgs[0] === '-m') {
                if (pythonPath.indexOf(' ') >= 0) {
                    installScript = `"${pythonPath}" ${installScript}`;
                }
                else {
                    installScript = `${pythonPath} ${installScript}`;
                }
            }
            Installer.terminal.sendText(installScript);
            Installer.terminal.show(false);
            // Unfortunately we won't know when the command has completed
            return Promise.resolve();
        }
    }

    isProductInstalled(product: Product): Promise<boolean> {
        return isProductInstalled(product);
    }
}

export function disableLinter(product: Product) {
    const pythonConfig = vscode.workspace.getConfiguration('python');
    const settingToDisable = SettingToDisableProduct.get(product);
    if (vscode.workspace.rootPath) {
        return pythonConfig.update(settingToDisable, false);
    }
    else {
        return pythonConfig.update('linting.enabledWithoutWorkspace', false, true);
    }
}

function isTestFrameworkInstalled(product: Product): Promise<boolean> {
    const fileToRun = product === Product.pytest ? 'py.test' : 'nosetests';
    const def = createDeferred<boolean>();
    execPythonFile(fileToRun, ['--version'], vscode.workspace.rootPath, false)
        .then(() => {
            def.resolve(true);
        }).catch(reason => {
            if (isNotInstalledError(reason)) {
                def.resolve(false);
            }
            else {
                def.resolve(true);
            }
        });
    return def.promise;
}
function isProductInstalled(product: Product): Promise<boolean> {
    switch (product) {
        case Product.pytest: {
            return isTestFrameworkInstalled(product);
        }
        case Product.nosetest: {
            return isTestFrameworkInstalled(product);
        }
    }
    throw new Error('Not supported');
}