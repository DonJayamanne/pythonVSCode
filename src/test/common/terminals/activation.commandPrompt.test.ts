// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
import { Uri } from 'vscode';
import { EnumEx } from '../../../client/common/enumUtils';
import { IFileSystem, IPlatformService } from '../../../client/common/platform/types';
import { CommandPromptAndPowerShell } from '../../../client/common/terminal/environmentActivationProviders/commandPrompt';
import { TerminalShellType } from '../../../client/common/terminal/types';
import { IConfigurationService, IPythonSettings } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Terminal Environment Activation (cmd/powershell)', () => {
    ['c:/programfiles/python/python', 'c:/program files/python/python',
        'c:\\users\\windows paths\\conda\\python.exe'].forEach(pythonPath => {
            const hasSpaces = pythonPath.indexOf(' ') > 0;
            const resource = Uri.file('a');

            const suiteTitle = hasSpaces ? 'and there are spaces in the script file (pythonpath),' : 'and there are no spaces in the script file (pythonpath),';
            suite(suiteTitle, () => {
                ['activate', 'activate.sh', 'activate.csh', 'activate.fish', 'activate.bat', 'activate.ps1'].forEach(scriptFileName => {
                    suite(`and script file is ${scriptFileName}`, () => {
                        let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                        let fileSystem: TypeMoq.IMock<IFileSystem>;
                        setup(() => {
                            serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                            fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                            serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);

                            const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                            serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
                            const settings = TypeMoq.Mock.ofType<IPythonSettings>();
                            settings.setup(s => s.pythonPath).returns(() => pythonPath);
                            configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                        });

                        EnumEx.getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(shellType => {
                            const isScriptFileSupported = ['activate.bat', 'activate.ps1'].indexOf(scriptFileName) >= 0;
                            const titleTitle = isScriptFileSupported ? `Ensure terminal type is supported (Shell: ${shellType.name})` :
                                `Ensure terminal type is not supported (Shell: ${shellType.name})`;

                            test(titleTitle, async () => {
                                const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                                const supported = bash.isShellSupported(shellType.value);
                                switch (shellType.value) {
                                    case TerminalShellType.commandPrompt:
                                    case TerminalShellType.powershellCore:
                                    case TerminalShellType.powershell: {
                                        expect(supported).to.be.equal(true, `${shellType.name} shell not supported (it should be)`);
                                        break;
                                    }
                                    default: {
                                        expect(supported).to.be.equal(false, `${shellType.name} incorrectly supported (should not be)`);
                                    }
                                }
                            });
                        });
                    });
                });

                suite('and script file is activate.bat', () => {
                    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                    let fileSystem: TypeMoq.IMock<IFileSystem>;
                    let platform: TypeMoq.IMock<IPlatformService>;
                    setup(() => {
                        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                        platform = TypeMoq.Mock.ofType<IPlatformService>();
                        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
                        serviceContainer.setup(c => c.get(IPlatformService)).returns(() => platform.object);

                        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
                        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
                        settings.setup(s => s.pythonPath).returns(() => pythonPath);
                        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                    });

                    test('Ensure batch files are supported by command prompt', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const commands = await bash.getActivationCommands(resource, TerminalShellType.commandPrompt);

                        // Ensure the script file is of the following form:
                        // source "<path to script file>" <environment name>
                        // Ensure the path is quoted if it contains any spaces.
                        // Ensure it contains the name of the environment as an argument to the script file.

                        expect(commands).to.be.deep.equal([pathToScriptFile.fileToCommandArgument()], 'Invalid command');
                    });

                    test('Ensure batch files are supported by powershell (on windows)', async () => {
                        const batch = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => true);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await batch.getActivationCommands(resource, TerminalShellType.powershell);

                        // Executing batch files from powershell requires going back to cmd, then into powershell

                        const activationCommand = pathToScriptFile.fileToCommandArgument();
                        const commands = [`& cmd /k "${activationCommand.replace(/"/g, '""')} & powershell"`];
                        expect(command).to.be.deep.equal(commands, 'Invalid command');
                    });

                    test('Ensure batch files are supported by powershell core (on windows)', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => true);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.powershellCore);

                        // Executing batch files from powershell requires going back to cmd, then into powershell

                        const activationCommand = pathToScriptFile.fileToCommandArgument();
                        const commands = [`& cmd /k "${activationCommand.replace(/"/g, '""')} & pwsh"`];
                        expect(command).to.be.deep.equal(commands, 'Invalid command');
                    });

                    test('Ensure batch files are not supported by powershell (on non-windows)', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => false);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.powershell);

                        expect(command).to.be.equal(undefined, 'Invalid command');
                    });

                    test('Ensure batch files are not supported by powershell core (on non-windows)', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => false);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.bat');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.powershellCore);

                        expect(command).to.be.equal(undefined, 'Invalid command');
                    });
                });

                suite('and script file is activate.ps1', () => {
                    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
                    let fileSystem: TypeMoq.IMock<IFileSystem>;
                    let platform: TypeMoq.IMock<IPlatformService>;
                    setup(() => {
                        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
                        fileSystem = TypeMoq.Mock.ofType<IFileSystem>();
                        platform = TypeMoq.Mock.ofType<IPlatformService>();
                        serviceContainer.setup(c => c.get(IFileSystem)).returns(() => fileSystem.object);
                        serviceContainer.setup(c => c.get(IPlatformService)).returns(() => platform.object);

                        const configService = TypeMoq.Mock.ofType<IConfigurationService>();
                        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IConfigurationService))).returns(() => configService.object);
                        const settings = TypeMoq.Mock.ofType<IPythonSettings>();
                        settings.setup(s => s.pythonPath).returns(() => pythonPath);
                        configService.setup(c => c.getSettings(TypeMoq.It.isAny())).returns(() => settings.object);
                    });

                    test('Ensure powershell files are not supported by command prompt', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => true);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.commandPrompt);

                        expect(command).to.be.deep.equal([], 'Invalid command (running powershell files are not supported on command prompt)');
                    });

                    test('Ensure powershell files are supported by powershell', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => true);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.powershell);

                        expect(command).to.be.deep.equal([`& ${pathToScriptFile.fileToCommandArgument()}`.trim()], 'Invalid command');
                    });

                    test('Ensure powershell files are supported by powershell core', async () => {
                        const bash = new CommandPromptAndPowerShell(serviceContainer.object);

                        platform.setup(p => p.isWindows).returns(() => true);
                        const pathToScriptFile = path.join(path.dirname(pythonPath), 'activate.ps1');
                        fileSystem.setup(fs => fs.fileExistsAsync(TypeMoq.It.isValue(pathToScriptFile))).returns(() => Promise.resolve(true));
                        const command = await bash.getActivationCommands(resource, TerminalShellType.powershellCore);

                        expect(command).to.be.deep.equal([`& ${pathToScriptFile.fileToCommandArgument()}`.trim()], 'Invalid command');
                    });
                });
            });
        });
});
