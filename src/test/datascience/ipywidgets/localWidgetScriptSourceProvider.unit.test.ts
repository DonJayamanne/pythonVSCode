// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { assert } from 'chai';
import * as path from 'path';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import { Uri } from 'vscode';
import { FileSystem } from '../../../client/common/platform/fileSystem';
import { IFileSystem } from '../../../client/common/platform/types';
import { LocalWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/localWidgetScriptSourceProvider';
import { IWidgetScriptSourceProvider } from '../../../client/datascience/ipywidgets/types';
import { JupyterNotebookBase } from '../../../client/datascience/jupyter/jupyterNotebook';
import { ILocalResourceUriConverter, INotebook } from '../../../client/datascience/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';

// tslint:disable: max-func-body-length no-any
suite('Data Science - ipywidget - Local Widget Script Source', () => {
    let scriptSourceProvider: IWidgetScriptSourceProvider;
    let notebook: INotebook;
    let resourceConverter: ILocalResourceUriConverter;
    let fs: IFileSystem;
    let interpreterService: IInterpreterService;
    const filesToLookSerachFor = `*${path.sep}index.js`;
    function asVSCodeUri(uri: Uri) {
        return `vscodeUri://${uri.fsPath}`;
    }
    setup(() => {
        notebook = mock(JupyterNotebookBase);
        resourceConverter = mock<ILocalResourceUriConverter>();
        fs = mock(FileSystem);
        interpreterService = mock(InterpreterService);
        when(resourceConverter.asWebviewUri(anything())).thenCall(asVSCodeUri);
        scriptSourceProvider = new LocalWidgetScriptSourceProvider(
            instance(notebook),
            instance(resourceConverter),
            instance(fs),
            instance(interpreterService)
        );
    });
    test('Empty list when there is no kernel associated with notebook', async () => {
        when(notebook.getKernelSpec()).thenReturn();

        const values = await scriptSourceProvider.getWidgetScriptSources();

        assert.deepEqual(values, []);
    });
    test('Empty list when there are no widgets', async () => {
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix: 'sysPrefix', path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([]);

        const values = await scriptSourceProvider.getWidgetScriptSources();

        assert.deepEqual(values, []);

        // Ensure we searched the directories.
        verify(fs.search(anything(), anything())).once();
    });
    test('Look for widgets in sysPath of interpreter defined in kernel metadata', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');

        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([]);

        const values = await scriptSourceProvider.getWidgetScriptSources();

        assert.deepEqual(values, []);

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
    test('Look for widgets in sysPath of kernel', async () => {
        const sysPrefix = 'sysPrefix Of Kernel';
        const kernelPath = 'kernel Path.exe';
        when(interpreterService.getInterpreterDetails(kernelPath)).thenResolve({ sysPrefix } as any);
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');

        when(notebook.getKernelSpec()).thenReturn({ path: kernelPath } as any);
        when(fs.search(anything(), anything())).thenResolve([]);

        const values = await scriptSourceProvider.getWidgetScriptSources();

        assert.deepEqual(values, []);

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
    test('Ensure we cache the list of all widgets', async () => {
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix: 'sysPrefix', path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([]);

        const values = await scriptSourceProvider.getWidgetScriptSources();
        assert.deepEqual(values, []);
        const values1 = await scriptSourceProvider.getWidgetScriptSources();
        assert.deepEqual(values1, []);
        const values2 = await scriptSourceProvider.getWidgetScriptSources();
        assert.deepEqual(values2, []);

        // Ensure we search directories once.
        verify(fs.search(anything(), anything())).once();
    });
    test('Return widget sources', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([
            'widget1/index.js',
            'widget2/index.js',
            'widget3/index.js'
        ]);

        const values = await scriptSourceProvider.getWidgetScriptSources();

        // Ensure the script paths are properly converted to be used within notebooks.
        assert.deepEqual(values, [
            {
                moduleName: 'widget1',
                source: 'local',
                scriptUri: asVSCodeUri(Uri.file(path.join(searchDirectory, 'widget1', 'index')))
            },
            {
                moduleName: 'widget2',
                source: 'local',
                scriptUri: asVSCodeUri(Uri.file(path.join(searchDirectory, 'widget2', 'index')))
            },
            {
                moduleName: 'widget3',
                source: 'local',
                scriptUri: asVSCodeUri(Uri.file(path.join(searchDirectory, 'widget3', 'index')))
            }
        ] as any);

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
        // We must use resource convert to conver paths.
        verify(resourceConverter.asWebviewUri(anything())).called();
    });
    test('Ensure we search directory only once (cache results)', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([
            'widget1/index.js',
            'widget2/index.js',
            'widget3/index.js'
        ]);

        const values = await scriptSourceProvider.getWidgetScriptSources();
        assert.equal(values.length, 3);
        const values1 = await scriptSourceProvider.getWidgetScriptSources();
        assert.equal(values1.length, 3);
        const values2 = await scriptSourceProvider.getWidgetScriptSources();
        assert.equal(values2.length, 3);

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
    test('Get source for a specific widget & search in the right place', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([
            'widget1/index.js',
            'widget2/index.js',
            'widget3/index.js'
        ]);

        const value = await scriptSourceProvider.getWidgetScriptSource('widget1', '1');

        // Ensure the script paths are properly converted to be used within notebooks.
        assert.deepEqual(value, {
            moduleName: 'widget1',
            source: 'local',
            scriptUri: asVSCodeUri(Uri.file(path.join(searchDirectory, 'widget1', 'index')))
        });

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
    test('Get source for a specific widget & ensure we search directory once (ensur we cache)', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([
            'widget1/index.js',
            'widget2/index.js',
            'widget3/index.js'
        ]);

        const value = await scriptSourceProvider.getWidgetScriptSource('widget2', '1');
        assert.deepEqual(value, {
            moduleName: 'widget2',
            source: 'local',
            scriptUri: asVSCodeUri(Uri.file(path.join(searchDirectory, 'widget2', 'index')))
        });
        const value1 = await scriptSourceProvider.getWidgetScriptSource('widget2', '1');
        assert.isOk(value1);
        const value2 = await scriptSourceProvider.getWidgetScriptSource('widget2', '1');
        assert.deepEqual(value2, value1);
        // We should ignore version numbers (when getting widget sources from local fs).
        const value3 = await scriptSourceProvider.getWidgetScriptSource('widget2', '1234');
        assert.deepEqual(value3, value1);

        // Ensure we look for the right things in the right place.
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
    test('Return empty source for widgets that cannot be found', async () => {
        const sysPrefix = 'sysPrefix Of Python in Metadata';
        const searchDirectory = path.join(sysPrefix, 'share', 'jupyter', 'nbextensions');
        when(notebook.getKernelSpec()).thenReturn({
            metadata: { interpreter: { sysPrefix, path: 'pythonPath' } }
        } as any);
        when(fs.search(anything(), anything())).thenResolve([
            'widget1/index.js',
            'widget2/index.js',
            'widget3/index.js'
        ]);

        const value = await scriptSourceProvider.getWidgetScriptSource('widgetNotFound', '1');
        assert.deepEqual(value, {
            moduleName: 'widgetNotFound'
        });
        const value1 = await scriptSourceProvider.getWidgetScriptSource('widgetNotFound', '1');
        assert.isOk(value1);
        const value2 = await scriptSourceProvider.getWidgetScriptSource('widgetNotFound', '1');
        assert.deepEqual(value2, value1);
        // We should ignore version numbers (when getting widget sources from local fs).
        const value3 = await scriptSourceProvider.getWidgetScriptSource('widgetNotFound', '1234');
        assert.deepEqual(value3, value1);

        // Ensure we look for the right things in the right place.
        // Also ensure we call once (& cache for subsequent searches).
        verify(fs.search(filesToLookSerachFor, searchDirectory)).once();
    });
});
