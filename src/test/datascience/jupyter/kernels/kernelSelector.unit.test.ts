// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { nbformat } from '@jupyterlab/coreutils';
import { assert } from 'chai';
import * as sinon from 'sinon';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { CancellationToken } from 'vscode-jsonrpc';

import { ApplicationShell } from '../../../../client/common/application/applicationShell';
import { IApplicationShell } from '../../../../client/common/application/types';
import { PYTHON_LANGUAGE } from '../../../../client/common/constants';
import { ProductInstaller } from '../../../../client/common/installer/productInstaller';
import { IInstaller, Product, Resource } from '../../../../client/common/types';
import * as localize from '../../../../client/common/utils/localize';
import { noop } from '../../../../client/common/utils/misc';
import { Architecture } from '../../../../client/common/utils/platform';
import { StopWatch } from '../../../../client/common/utils/stopWatch';
import { JupyterSessionManager } from '../../../../client/datascience/jupyter/jupyterSessionManager';
import { KernelSelectionProvider } from '../../../../client/datascience/jupyter/kernels/kernelSelections';
import { KernelSelector } from '../../../../client/datascience/jupyter/kernels/kernelSelector';
import { KernelService } from '../../../../client/datascience/jupyter/kernels/kernelService';
import { IKernelSpecQuickPickItem, LiveKernelModel } from '../../../../client/datascience/jupyter/kernels/types';
import { IJupyterKernelSpec, IJupyterSessionManager } from '../../../../client/datascience/types';
import { IInterpreterService, InterpreterType, PythonInterpreter } from '../../../../client/interpreter/contracts';
import { InterpreterService } from '../../../../client/interpreter/interpreterService';

// tslint:disable: max-func-body-length

suite('Data Science - KernelSelector', () => {
    let kernelSelectionProvider: KernelSelectionProvider;
    let kernelService: KernelService;
    let sessionManager: IJupyterSessionManager;
    let kernelSelector: KernelSelector;
    let interpreterService: IInterpreterService;
    let appShell: IApplicationShell;
    let installer: IInstaller;
    const kernelSpec = {
        argv: [],
        display_name: 'Something',
        dispose: async () => noop(),
        language: PYTHON_LANGUAGE,
        name: 'SomeName',
        path: 'somePath',
        env: {}
    };
    const interpreter: PythonInterpreter = {
        displayName: 'Something',
        architecture: Architecture.Unknown,
        path: 'somePath',
        sysPrefix: '',
        sysVersion: '',
        type: InterpreterType.Conda
    };

    setup(() => {
        sessionManager = mock(JupyterSessionManager);
        kernelService = mock(KernelService);
        kernelSelectionProvider = mock(KernelSelectionProvider);
        appShell = mock(ApplicationShell);
        installer = mock(ProductInstaller);
        interpreterService = mock(InterpreterService);
        kernelSelector = new KernelSelector(
            instance(kernelSelectionProvider),
            instance(appShell),
            instance(kernelService),
            instance(interpreterService),
            instance(installer)
        );
    });
    teardown(() => sinon.restore());
    suite('Select Remote Kernel', () => {
        test('Should display quick pick and return nothing when nothing is selected (remote sessions)', async () => {
            when(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve();

            const kernel = await kernelSelector.selectRemoteKernel(
                undefined,
                new StopWatch(),
                instance(sessionManager)
            );

            assert.isEmpty(kernel);
            verify(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
        });
        test('Should display quick pick and return nothing when nothing is selected (local sessions)', async () => {
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve();

            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isEmpty(kernel);
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
        });
        test('Should return the selected remote kernelspec along with a matching interpreter', async () => {
            when(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(kernelService.findMatchingInterpreter(kernelSpec, anything())).thenResolve(interpreter);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve({
                selection: { kernelSpec }
                // tslint:disable-next-line: no-any
            } as any);

            const kernel = await kernelSelector.selectRemoteKernel(
                undefined,
                new StopWatch(),
                instance(sessionManager)
            );

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            verify(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).once();
        });
    });
    suite('Hide kernels from Remote & Local Kernel', () => {
        test('Should hide kernel from remote sessions', async () => {
            const kernelModels: LiveKernelModel[] = [
                {
                    lastActivityTime: new Date(),
                    name: '1one',
                    numberOfConnections: 1,
                    id: 'id1',
                    display_name: '1',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '2two',
                    numberOfConnections: 1,
                    id: 'id2',
                    display_name: '2',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '3three',
                    numberOfConnections: 1,
                    id: 'id3',
                    display_name: '3',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '4four',
                    numberOfConnections: 1,
                    id: 'id4',
                    display_name: '4',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                }
            ];
            const quickPickItems: IKernelSpecQuickPickItem[] = kernelModels.map((kernelModel) => {
                return {
                    label: '',
                    selection: { kernelModel, kernelSpec: undefined, interpreter: undefined }
                };
            });

            when(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve(quickPickItems);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve(undefined);

            // tslint:disable-next-line: no-any
            kernelSelector.addKernelToIgnoreList({ id: 'id2' } as any);
            // tslint:disable-next-line: no-any
            kernelSelector.addKernelToIgnoreList({ clientId: 'id4' } as any);
            const kernel = await kernelSelector.selectRemoteKernel(
                undefined,
                new StopWatch(),
                instance(sessionManager)
            );

            assert.isEmpty(kernel);
            verify(
                kernelSelectionProvider.getKernelSelectionsForRemoteSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            const suggestions = capture(appShell.showQuickPick).first()[0] as IKernelSpecQuickPickItem[];
            assert.deepEqual(
                suggestions,
                quickPickItems.filter((item) => !['id2', 'id4'].includes(item.selection?.kernelModel?.id || ''))
            );
        });
        test('Should hide kernel from local sessions', async () => {
            const kernelModels: LiveKernelModel[] = [
                {
                    lastActivityTime: new Date(),
                    name: '1one',
                    numberOfConnections: 1,
                    id: 'id1',
                    display_name: '1',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '2two',
                    numberOfConnections: 1,
                    id: 'id2',
                    display_name: '2',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '3three',
                    numberOfConnections: 1,
                    id: 'id3',
                    display_name: '3',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                },
                {
                    lastActivityTime: new Date(),
                    name: '4four',
                    numberOfConnections: 1,
                    id: 'id4',
                    display_name: '4',
                    // tslint:disable-next-line: no-any
                    session: {} as any
                }
            ];
            const quickPickItems: IKernelSpecQuickPickItem[] = kernelModels.map((kernelModel) => {
                return {
                    label: '',
                    selection: { kernelModel, kernelSpec: undefined, interpreter: undefined }
                };
            });

            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve(quickPickItems);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve(undefined);

            // tslint:disable-next-line: no-any
            kernelSelector.addKernelToIgnoreList({ id: 'id2' } as any);
            // tslint:disable-next-line: no-any
            kernelSelector.addKernelToIgnoreList({ clientId: 'id4' } as any);
            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isEmpty(kernel);
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            const suggestions = capture(appShell.showQuickPick).first()[0] as IKernelSpecQuickPickItem[];
            assert.deepEqual(
                suggestions,
                quickPickItems.filter((item) => !['id2', 'id4'].includes(item.selection?.kernelModel?.id || ''))
            );
        });
    });
    suite('Select Local Kernel', () => {
        test('Should return the selected local kernelspec along with a matching interpreter', async () => {
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(kernelService.findMatchingInterpreter(kernelSpec, anything())).thenResolve(interpreter);
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve({
                selection: { kernelSpec }
                // tslint:disable-next-line: no-any
            } as any);

            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).once();
        });
        test('If seleted interpreter has ipykernel installed, then return matching kernelspec and interpreter', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            when(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).thenResolve(
                kernelSpec
            );
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(
                appShell.showInformationMessage(localize.DataScience.fallbackToUseActiveInterpeterAsKernel())
            ).thenResolve();
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve({
                selection: { interpreter, kernelSpec }
                // tslint:disable-next-line: no-any
            } as any);

            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isOk(kernel.kernelSpec === kernelSpec);
            verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
            verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).once();
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            verify(kernelService.registerKernel(anything(), anything())).never();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallbackToUseActiveInterpeterAsKernel())
            ).never();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel())
            ).never();
        });
        test('If seleted interpreter has ipykernel installed and there is no matching kernelSpec, then register a new kernel and return the new kernelspec and interpreter', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(true);
            when(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).thenResolve();
            when(kernelService.registerKernel(interpreter, anything(), anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(
                appShell.showInformationMessage(localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel())
            ).thenResolve();
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve({
                selection: { interpreter, kernelSpec }
                // tslint:disable-next-line: no-any
            } as any);

            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
            verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).once();
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).twice(); // Once for caching.
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallbackToUseActiveInterpeterAsKernel())
            ).never();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel())
            ).never();
        });
        test('If seleted interpreter does not have ipykernel installed and there is no matching kernelspec, then register a new kernel and return the new kernelspec and interpreter', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(kernelService.registerKernel(interpreter, anything(), anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).thenResolve([]);
            when(
                appShell.showInformationMessage(localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel())
            ).thenResolve();
            when(appShell.showQuickPick(anything(), anything(), anything())).thenResolve({
                selection: { interpreter, kernelSpec }
                // tslint:disable-next-line: no-any
            } as any);

            const kernel = await kernelSelector.selectLocalKernel(undefined, new StopWatch(), instance(sessionManager));

            assert.isOk(kernel.kernelSpec === kernelSpec);
            verify(installer.isInstalled(Product.ipykernel, interpreter)).once();
            verify(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(
                    anything(),
                    instance(sessionManager),
                    anything()
                )
            ).twice(); // once for caching.
            verify(appShell.showQuickPick(anything(), anything(), anything())).once();
            verify(kernelService.findMatchingKernelSpec(interpreter, instance(sessionManager), anything())).never();
            verify(kernelService.registerKernel(interpreter, anything(), anything())).once();
            verify(appShell.showInformationMessage(anything(), anything(), anything())).never();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallbackToUseActiveInterpeterAsKernel())
            ).never();
            verify(
                appShell.showInformationMessage(localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel())
            ).never();
        });
    });
    // tslint:disable-next-line: max-func-body-length
    suite('Get a kernel for local sessions', () => {
        // tslint:disable-next-line: no-any
        let nbMetadataKernelSpec: nbformat.IKernelspecMetadata = {} as any;
        // tslint:disable-next-line: no-any
        let nbMetadata: nbformat.INotebookMetadata = {} as any;
        let selectLocalKernelStub: sinon.SinonStub<
            [
                Resource,
                StopWatch,
                (IJupyterSessionManager | undefined)?,
                (CancellationToken | undefined)?,
                (IJupyterKernelSpec | LiveKernelModel)?
            ],
            // tslint:disable-next-line: no-any
            Promise<any>
        >;
        setup(() => {
            nbMetadataKernelSpec = {
                display_name: interpreter.displayName!,
                name: kernelSpec.name
            };
            nbMetadata = {
                // tslint:disable-next-line: no-any
                kernelspec: nbMetadataKernelSpec as any,
                orig_nbformat: 4,
                language_info: { name: PYTHON_LANGUAGE }
            };
            selectLocalKernelStub = sinon.stub(KernelSelector.prototype, 'selectLocalKernel');
            selectLocalKernelStub.resolves({ kernelSpec, interpreter });
        });
        teardown(() => sinon.restore());
        test('If metadata contains kernel information, then return a matching kernel and a matching interpreter', async () => {
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(kernelSpec);
            when(kernelService.findMatchingInterpreter(kernelSpec, anything())).thenResolve(interpreter);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForLocalConnection(
                anything(),
                instance(sessionManager),
                nbMetadata
            );

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).once();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything(), anything())).never();
        });
        test('If metadata contains kernel information, then return a matching kernel (even if there is no matching interpreter)', async () => {
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(kernelSpec);
            when(kernelService.findMatchingInterpreter(kernelSpec, anything())).thenResolve();
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForLocalConnection(
                undefined,
                instance(sessionManager),
                nbMetadata
            );

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isUndefined(kernel.interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).once();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).once();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything(), anything())).never();
        });
        test('If metadata contains kernel information, and there is matching kernelspec, then use current interpreter as a kernel', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(undefined);
            when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);
            when(kernelService.registerKernel(anything(), anything(), anything())).thenResolve(kernelSpec);
            when(
                appShell.showInformationMessage(localize.DataScience.fallbackToUseActiveInterpeterAsKernel())
            ).thenResolve();
            when(
                appShell.showInformationMessage(
                    localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel().format(
                        nbMetadata.kernelspec?.display_name!
                    )
                )
            ).thenResolve();
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForLocalConnection(
                undefined,
                instance(sessionManager),
                nbMetadata
            );

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).once();
            verify(kernelService.updateKernelEnvironment(interpreter, anything(), anything())).never();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).never();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything(), anything())).once();
            verify(
                appShell.showInformationMessage(
                    localize.DataScience.fallBackToPromptToUseActiveInterpreterOrSelectAKernel()
                )
            ).never();
            verify(
                appShell.showInformationMessage(
                    localize.DataScience.fallBackToRegisterAndUseActiveInterpeterAsKernel().format(
                        nbMetadata.kernelspec?.display_name!
                    )
                )
            ).once();
        });
        test('If metadata is empty, then use active interperter and find a kernel matching active interpreter', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(undefined);
            when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);
            when(kernelService.searchAndRegisterKernel(interpreter, anything(), anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForLocalConnection(
                undefined,
                instance(sessionManager),
                undefined
            );

            assert.isOk(kernel.kernelSpec === kernelSpec);
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(appShell.showInformationMessage(anything(), anything(), anything())).never();
            verify(kernelService.searchAndRegisterKernel(interpreter, anything(), anything())).once();
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).never();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).never();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything())).never();
        });
        test('Remote search works', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(undefined);
            when(kernelService.getKernelSpecs(anything(), anything())).thenResolve([
                {
                    name: 'bar',
                    display_name: 'foo',
                    language: 'CSharp',
                    path: '/foo/dotnet',
                    argv: [],
                    env: {}
                },
                {
                    name: 'foo',
                    display_name: 'foo',
                    language: 'Python',
                    path: '/foo/python',
                    argv: [],
                    env: {}
                }
            ]);
            when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);
            when(kernelService.searchAndRegisterKernel(interpreter, anything(), anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForRemoteConnection(
                undefined,
                instance(sessionManager),
                undefined
            );

            assert.ok(kernel.kernelSpec, 'No kernel spec found for remote');
            assert.equal(kernel.kernelSpec?.display_name, 'foo', 'Did not find the python kernel spec');
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(appShell.showInformationMessage(anything(), anything(), anything())).never();
            verify(kernelService.searchAndRegisterKernel(interpreter, anything(), anything())).never();
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).never();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).never();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything(), anything())).never();
        });
        test('Remote search prefers same name as long as it is python', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(undefined);
            when(kernelService.getKernelSpecs(anything(), anything())).thenResolve([
                {
                    name: 'bar',
                    display_name: 'foo',
                    language: 'CSharp',
                    path: '/foo/dotnet',
                    argv: [],
                    env: {}
                },
                {
                    name: 'foo',
                    display_name: 'zip',
                    language: 'Python',
                    path: '/foo/python',
                    argv: [],
                    env: undefined
                },
                {
                    name: 'foo',
                    display_name: 'foo',
                    language: 'Python',
                    path: '/foo/python',
                    argv: [],
                    env: undefined
                }
            ]);
            when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);
            when(kernelService.searchAndRegisterKernel(interpreter, anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForRemoteConnection(undefined, instance(sessionManager), {
                orig_nbformat: 4,
                kernelspec: { display_name: 'foo', name: 'foo' }
            });

            assert.ok(kernel.kernelSpec, 'No kernel spec found for remote');
            assert.equal(kernel.kernelSpec?.display_name, 'foo', 'Did not find the preferred python kernel spec');
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(appShell.showInformationMessage(anything(), anything(), anything())).never();
            verify(kernelService.searchAndRegisterKernel(interpreter, anything())).never();
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).never();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).never();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything())).never();
        });
        test('Remote search prefers same version', async () => {
            when(installer.isInstalled(Product.ipykernel, interpreter)).thenResolve(false);
            when(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).thenResolve(undefined);
            when(kernelService.getKernelSpecs(anything(), anything())).thenResolve([
                {
                    name: 'bar',
                    display_name: 'fod',
                    language: 'CSharp',
                    path: '/foo/dotnet',
                    argv: [],
                    env: {}
                },
                {
                    name: 'python2',
                    display_name: 'zip',
                    language: 'Python',
                    path: '/foo/python',
                    argv: [],
                    env: undefined
                },
                {
                    name: 'python3',
                    display_name: 'foo',
                    language: 'Python',
                    path: '/foo/python',
                    argv: [],
                    env: undefined
                }
            ]);
            when(interpreterService.getActiveInterpreter(undefined)).thenResolve(interpreter);
            when(kernelService.searchAndRegisterKernel(interpreter, anything())).thenResolve(kernelSpec);
            when(
                kernelSelectionProvider.getKernelSelectionsForLocalSession(anything(), anything(), anything())
            ).thenResolve();

            const kernel = await kernelSelector.getKernelForRemoteConnection(undefined, instance(sessionManager), {
                orig_nbformat: 4,
                kernelspec: { display_name: 'foo', name: 'foo' }
            });

            assert.ok(kernel.kernelSpec, 'No kernel spec found for remote');
            assert.equal(kernel.kernelSpec?.display_name, 'foo', 'Did not find the preferred python kernel spec');
            assert.isOk(kernel.interpreter === interpreter);
            assert.isOk(selectLocalKernelStub.notCalled);
            verify(appShell.showInformationMessage(anything(), anything(), anything())).never();
            verify(kernelService.searchAndRegisterKernel(interpreter, anything())).never();
            verify(
                kernelService.findMatchingKernelSpec(nbMetadataKernelSpec, instance(sessionManager), anything())
            ).never();
            verify(kernelService.findMatchingInterpreter(kernelSpec, anything())).never();
            verify(appShell.showQuickPick(anything(), anything(), anything())).never();
            verify(kernelService.registerKernel(anything(), anything())).never();
        });
    });
});
