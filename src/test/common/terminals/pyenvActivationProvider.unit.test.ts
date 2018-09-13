// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import '../../../client/common/extensions';
import { PyEnvActivationCommandProvider } from '../../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { ITerminalActivationCommandProvider, TerminalShellType } from '../../../client/common/terminal/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { getNamesAndValues } from '../../../utils/enum';
import { Architecture } from '../../../utils/platform';

suite('Terminal Environment Activation pyenv', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let activationProvider: ITerminalActivationCommandProvider;

    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);

        activationProvider = new PyEnvActivationCommandProvider(serviceContainer.object);
    });

    test('All shells should be supported', async () => {
        for (const item of getNamesAndValues<TerminalShellType>(TerminalShellType)) {
            expect(activationProvider.isShellSupported(item.value)).to.equal(true, 'All shells should be supported');
        }
    });

    test('Ensure no activation commands are returned if intrepreter info is not found', async () => {
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(undefined))
            .verifiable(TypeMoq.Times.once());

        const activationCommands = await activationProvider.getActivationCommands(undefined, TerminalShellType.bash);
        expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    });

    test('Ensure no activation commands are returned if intrepreter is not pyenv', async () => {
        const intepreterInfo: PythonInterpreter = {
            architecture: Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: InterpreterType.Unknown
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());

        const activationCommands = await activationProvider.getActivationCommands(undefined, TerminalShellType.bash);
        expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    });

    test('Ensure no activation commands are returned if intrepreter envName is empty', async () => {
        const intepreterInfo: PythonInterpreter = {
            architecture: Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: InterpreterType.Pyenv
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());

        const activationCommands = await activationProvider.getActivationCommands(undefined, TerminalShellType.bash);
        expect(activationCommands).to.equal(undefined, 'Activation commands should be undefined');
    });

    test('Ensure activation command is returned', async () => {
        const intepreterInfo: PythonInterpreter = {
            architecture: Architecture.Unknown,
            path: '',
            sysPrefix: '',
            version: '',
            version_info: [1, 1, 1, 'alpha'],
            sysVersion: '',
            type: InterpreterType.Pyenv,
            envName: 'my env name'
        };
        interpreterService
            .setup(i => i.getActiveInterpreter(TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(intepreterInfo))
            .verifiable(TypeMoq.Times.once());

        const activationCommands = await activationProvider.getActivationCommands(undefined, TerminalShellType.bash);
        expect(activationCommands).to.deep.equal([`pyenv shell ${intepreterInfo.envName}`], 'Invalid Activation command');
    });
});
