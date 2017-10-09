import * as vscode from 'vscode';
import * as settings from './configSettings';
import * as os from 'os';
import { commands, ConfigurationTarget, Disposable, OutputChannel, Terminal, Uri, window, workspace } from 'vscode';
import { isNotInstalledError } from './helpers';
import { execPythonFile, getFullyQualifiedPythonInterpreterPath } from './utils';

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
    ctags,
    rope
}

const ProductInstallScripts = new Map<Product, string[]>();
ProductInstallScripts.set(Product.autopep8, ['-m', 'pip', 'install', 'autopep8']);
ProductInstallScripts.set(Product.flake8, ['-m', 'pip', 'install', 'flake8']);
ProductInstallScripts.set(Product.mypy, ['-m', 'pip', 'install', 'mypy']);
ProductInstallScripts.set(Product.nosetest, ['-m', 'pip', 'install', 'nose']);
ProductInstallScripts.set(Product.pep8, ['-m', 'pip', 'install', 'pep8']);
ProductInstallScripts.set(Product.pylama, ['-m', 'pip', 'install', 'pylama']);
ProductInstallScripts.set(Product.prospector, ['-m', 'pip', 'install', 'prospector']);
ProductInstallScripts.set(Product.pydocstyle, ['-m', 'pip', 'install', 'pydocstyle']);
ProductInstallScripts.set(Product.pylint, ['-m', 'pip', 'install', 'pylint']);
ProductInstallScripts.set(Product.pytest, ['-m', 'pip', 'install', '-U', 'pytest']);
ProductInstallScripts.set(Product.yapf, ['-m', 'pip', 'install', 'yapf']);
ProductInstallScripts.set(Product.rope, ['-m', 'pip', 'install', 'rope']);

const ProductUninstallScripts = new Map<Product, string[]>();
ProductUninstallScripts.set(Product.autopep8, ['-m', 'pip', 'uninstall', 'autopep8', '--yes']);
ProductUninstallScripts.set(Product.flake8, ['-m', 'pip', 'uninstall', 'flake8', '--yes']);
ProductUninstallScripts.set(Product.mypy, ['-m', 'pip', 'uninstall', 'mypy', '--yes']);
ProductUninstallScripts.set(Product.nosetest, ['-m', 'pip', 'uninstall', 'nose', '--yes']);
ProductUninstallScripts.set(Product.pep8, ['-m', 'pip', 'uninstall', 'pep8', '--yes']);
ProductUninstallScripts.set(Product.pylama, ['-m', 'pip', 'uninstall', 'pylama', '--yes']);
ProductUninstallScripts.set(Product.prospector, ['-m', 'pip', 'uninstall', 'prospector', '--yes']);
ProductUninstallScripts.set(Product.pydocstyle, ['-m', 'pip', 'uninstall', 'pydocstyle', '--yes']);
ProductUninstallScripts.set(Product.pylint, ['-m', 'pip', 'uninstall', 'pylint', '--yes']);
ProductUninstallScripts.set(Product.pytest, ['-m', 'pip', 'uninstall', 'pytest', '--yes']);
ProductUninstallScripts.set(Product.yapf, ['-m', 'pip', 'uninstall', 'yapf', '--yes']);
ProductUninstallScripts.set(Product.rope, ['-m', 'pip', 'uninstall', 'rope', '--yes']);

export const ProductExecutableAndArgs = new Map<Product, { executable: string, args: string[] }>();
ProductExecutableAndArgs.set(Product.mypy, { executable: 'python', args: ['-m', 'mypy'] });
ProductExecutableAndArgs.set(Product.nosetest, { executable: 'python', args: ['-m', 'nose'] });
ProductExecutableAndArgs.set(Product.pylama, { executable: 'python', args: ['-m', 'pylama'] });
ProductExecutableAndArgs.set(Product.prospector, { executable: 'python', args: ['-m', 'prospector'] });
ProductExecutableAndArgs.set(Product.pylint, { executable: 'python', args: ['-m', 'pylint'] });
ProductExecutableAndArgs.set(Product.pytest, { executable: 'python', args: ['-m', 'pytest'] });
ProductExecutableAndArgs.set(Product.autopep8, { executable: 'python', args: ['-m', 'autopep8'] });
ProductExecutableAndArgs.set(Product.pep8, { executable: 'python', args: ['-m', 'pep8'] });
ProductExecutableAndArgs.set(Product.pydocstyle, { executable: 'python', args: ['-m', 'pydocstyle'] });
ProductExecutableAndArgs.set(Product.yapf, { executable: 'python', args: ['-m', 'yapf'] });
ProductExecutableAndArgs.set(Product.flake8, { executable: 'python', args: ['-m', 'flake8'] });

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

export const Linters: Product[] = [
    Product.flake8,
    Product.pep8,
    Product.pylama,
    Product.prospector,
    Product.pylint,
    Product.mypy,
    Product.pydocstyle
];

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
ProductNames.set(Product.rope, 'rope');

export const SettingToDisableProduct = new Map<Product, string>();
SettingToDisableProduct.set(Product.flake8, 'linting.flake8Enabled');
SettingToDisableProduct.set(Product.mypy, 'linting.mypyEnabled');
SettingToDisableProduct.set(Product.nosetest, 'unitTest.nosetestsEnabled');
SettingToDisableProduct.set(Product.pep8, 'linting.pep8Enabled');
SettingToDisableProduct.set(Product.pylama, 'linting.pylamaEnabled');
SettingToDisableProduct.set(Product.prospector, 'linting.prospectorEnabled');
SettingToDisableProduct.set(Product.pydocstyle, 'linting.pydocstyleEnabled');
SettingToDisableProduct.set(Product.pylint, 'linting.pylintEnabled');
SettingToDisableProduct.set(Product.pytest, 'unitTest.pyTestEnabled');

const ProductInstallationPrompt = new Map<Product, string>();
ProductInstallationPrompt.set(Product.ctags, 'Install CTags to enable Python workspace symbols');

enum ProductType {
    Linter,
    Formatter,
    TestFramework,
    RefactoringLibrary,
    WorkspaceSymbols
}

const ProductTypeNames = new Map<ProductType, string>();
ProductTypeNames.set(ProductType.Formatter, 'Formatter');
ProductTypeNames.set(ProductType.Linter, 'Linter');
ProductTypeNames.set(ProductType.RefactoringLibrary, 'Refactoring library');
ProductTypeNames.set(ProductType.TestFramework, 'Test Framework');
ProductTypeNames.set(ProductType.WorkspaceSymbols, 'Workspace Symbols');

const ProductTypes = new Map<Product, ProductType>();
ProductTypes.set(Product.flake8, ProductType.Linter);
ProductTypes.set(Product.mypy, ProductType.Linter);
ProductTypes.set(Product.pep8, ProductType.Linter);
ProductTypes.set(Product.prospector, ProductType.Linter);
ProductTypes.set(Product.pydocstyle, ProductType.Linter);
ProductTypes.set(Product.pylama, ProductType.Linter);
ProductTypes.set(Product.pylint, ProductType.Linter);
ProductTypes.set(Product.ctags, ProductType.WorkspaceSymbols);
ProductTypes.set(Product.nosetest, ProductType.TestFramework);
ProductTypes.set(Product.pytest, ProductType.TestFramework);
ProductTypes.set(Product.unittest, ProductType.TestFramework);
ProductTypes.set(Product.autopep8, ProductType.Formatter);
ProductTypes.set(Product.yapf, ProductType.Formatter);
ProductTypes.set(Product.rope, ProductType.RefactoringLibrary);

export enum InstallerResponse {
    Installed,
    Disabled,
    Ignore
}
export class Installer implements vscode.Disposable {
    private static terminal: vscode.Terminal | undefined | null;
    private disposables: vscode.Disposable[] = [];
    constructor(private outputChannel?: vscode.OutputChannel) {
        this.disposables.push(vscode.window.onDidCloseTerminal(term => {
            if (term === Installer.terminal) {
                Installer.terminal = null;
            }
        }));
    }
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    private shouldDisplayPrompt(product: Product) {
        const productName = ProductNames.get(product)!;
        const pythonConfig = workspace.getConfiguration('python');
        const disablePromptForFeatures = pythonConfig.get('disablePromptForFeatures', [] as string[]);
        return disablePromptForFeatures.indexOf(productName) === -1;
    }

    public async promptToInstall(product: Product, resource?: Uri): Promise<InstallerResponse> {
        const productType = ProductTypes.get(product)!;
        const productTypeName = ProductTypeNames.get(productType);
        const productName = ProductNames.get(product)!;

        if (!this.shouldDisplayPrompt(product)) {
            const message = `${productTypeName} '${productName}' not installed.`;
            if (this.outputChannel) {
                this.outputChannel.appendLine(message);
            }
            else {
                console.warn(message);
            }
            return InstallerResponse.Ignore;
        }

        const installOption = ProductInstallationPrompt.has(product) ? ProductInstallationPrompt.get(product) : 'Install ' + productName;
        const disableOption = 'Disable ' + productTypeName;
        const dontShowAgain = `Don't show this prompt again`;
        const alternateFormatter = product === Product.autopep8 ? 'yapf' : 'autopep8';
        const useOtherFormatter = `Use '${alternateFormatter}' formatter`;
        const options = [];
        options.push(installOption);
        if (productType === ProductType.Formatter) {
            options.push(...[useOtherFormatter]);
        }
        if (SettingToDisableProduct.has(product)) {
            options.push(...[disableOption, dontShowAgain]);
        }
        const item = await window.showErrorMessage(`${productTypeName} ${productName} is not installed`, ...options);
        switch (item) {
            case installOption: {
                return this.install(product, resource);
            }
            case disableOption: {
                if (Linters.indexOf(product) >= 0) {
                    return this.disableLinter(product, resource).then(() => InstallerResponse.Disabled);
                }
                else {
                    const settingToDisable = SettingToDisableProduct.get(product)!;
                    return this.updateSetting(settingToDisable, false, resource).then(() => InstallerResponse.Disabled);
                }
            }
            case useOtherFormatter: {
                return this.updateSetting('formatting.provider', alternateFormatter, resource)
                    .then(() => InstallerResponse.Installed);
            }
            case dontShowAgain: {
                const pythonConfig = workspace.getConfiguration('python');
                const features = pythonConfig.get('disablePromptForFeatures', [] as string[]);
                features.push(productName);
                return pythonConfig.update('disablePromptForFeatures', features, true).then(() => InstallerResponse.Ignore);
            }
        }
    }
    public async install(product: Product, resource?: Uri): Promise<InstallerResponse> {
        if (!this.outputChannel && !Installer.terminal) {
            Installer.terminal = window.createTerminal('Python Installer');
        }

        if (product === Product.ctags && settings.IS_WINDOWS) {
            if (this.outputChannel) {
                this.outputChannel.appendLine('Install Universal Ctags Win32 to enable support for Workspace Symbols');
                this.outputChannel.appendLine('Download the CTags binary from the Universal CTags site.');
                this.outputChannel.appendLine('Option 1: Extract ctags.exe from the downloaded zip to any folder within your PATH so that Visual Studio Code can run it.');
                this.outputChannel.appendLine('Option 2: Extract to any folder and add the path to this folder to the command setting.');
                this.outputChannel.appendLine('Option 3: Extract to any folder and define that path in the python.workspaceSymbols.ctagsPath setting of your user settings file (settings.json).');
                this.outputChannel.show();
            }
            else {
                window.showInformationMessage('Install Universal Ctags and set it in your path or define the path in your python.workspaceSymbols.ctagsPath settings');
            }
            return InstallerResponse.Ignore;
        }

        let installArgs = ProductInstallScripts.get(product)!;
        let pipIndex = installArgs.indexOf('pip');
        if (pipIndex > 0) {
            installArgs = installArgs.slice();
            let proxy = vscode.workspace.getConfiguration('http').get('proxy', '');
            if (proxy.length > 0) {
                installArgs.splice(2, 0, proxy);
                installArgs.splice(2, 0, '--proxy');
            }
        }
        let installationPromise: Promise<any>;
        if (this.outputChannel && installArgs[0] === '-m') {
            // Errors are just displayed to the user
            this.outputChannel.show();
            installationPromise = execPythonFile(settings.PythonSettings.getInstance(resource).pythonPath,
                installArgs, getCwdForInstallScript(resource), true, (data) => { this.outputChannel!.append(data); });
        }
        else {
            // When using terminal get the fully qualitified path
            // Cuz people may launch vs code from terminal when they have activated the appropriate virtual env
            // Problem is terminal doesn't use the currently activated virtual env
            // Must have something to do with the process being launched in the terminal
            installationPromise = getFullyQualifiedPythonInterpreterPath()
                .then(pythonPath => {
                    let installScript = installArgs.join(' ');

                    if (installArgs[0] === '-m') {
                        if (pythonPath.indexOf(' ') >= 0) {
                            installScript = `"${pythonPath}" ${installScript}`;
                        }
                        else {
                            installScript = `${pythonPath} ${installScript}`;
                        }
                    }
                    Installer.terminal!.sendText(installScript);
                    Installer.terminal!.show(false);
                });
        }

        return installationPromise
            .then(() => this.isInstalled(product))
            .then(isInstalled => isInstalled ? InstallerResponse.Installed : InstallerResponse.Ignore);
    }

    public isInstalled(product: Product, resource?: Uri): Promise<boolean | undefined> {
        return isProductInstalled(product, resource);
    }

    public uninstall(product: Product, resource?: Uri): Promise<any> {
        return uninstallproduct(product, resource);
    }
    public disableLinter(product: Product, resource: Uri) {
        if (resource && !workspace.getWorkspaceFolder(resource)) {
            const settingToDisable = SettingToDisableProduct.get(product)!;
            const pythonConfig = workspace.getConfiguration('python', resource);
            return pythonConfig.update(settingToDisable, false, ConfigurationTarget.Workspace);
        }
        else {
            const pythonConfig = workspace.getConfiguration('python');
            return pythonConfig.update('linting.enabledWithoutWorkspace', false, true);
        }
    }
    private updateSetting(setting: string, value: any, resource?: Uri) {
        if (resource && !workspace.getWorkspaceFolder(resource)) {
            const pythonConfig = workspace.getConfiguration('python', resource);
            return pythonConfig.update(setting, value, ConfigurationTarget.Workspace);
        }
        else {
            const pythonConfig = workspace.getConfiguration('python');
            return pythonConfig.update(setting, value, true);
        }
    }
}

function getCwdForInstallScript(resource?: Uri) {
    const workspaceFolder = workspace.getWorkspaceFolder(resource);
    if (workspaceFolder) {
        return workspaceFolder.uri.fsPath;
    }
    if (Array.isArray(workspace.workspaceFolders) && workspace.workspaceFolders.length > 0) {
        return workspace.workspaceFolders[0].uri.fsPath;
    }
    return __dirname;
}

async function isProductInstalled(product: Product, resource?: Uri): Promise<boolean | undefined> {
    if (!ProductExecutableAndArgs.has(product)) {
        return;
    }
    const prodExec = ProductExecutableAndArgs.get(product)!;
    const cwd = getCwdForInstallScript(resource);
    return execPythonFile(prodExec.executable, prodExec.args.concat(['--version']), cwd, false)
        .then(() => true)
        .catch(reason => !isNotInstalledError(reason));
}

function uninstallproduct(product: Product, resource?: Uri): Promise<any> {
    if (!ProductUninstallScripts.has(product)) {
        return Promise.resolve();
    }
    const uninstallArgs = ProductUninstallScripts.get(product)!;
    return execPythonFile('python', uninstallArgs, getCwdForInstallScript(resource), false);
}