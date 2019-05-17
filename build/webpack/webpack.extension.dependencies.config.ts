// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as webpack from 'webpack';
import { ExtensionRootDir } from '../constants';
import { getDefaultPlugins, nodeModulesToExternalize } from './common';
import copyWebpackPlugin = require('copy-webpack-plugin');

const entryItems: Record<string, string> = {};
nodeModulesToExternalize.forEach(moduleName => {
    entryItems[`node_modules/${moduleName}`] = `./node_modules/${moduleName}`;
});

const config: webpack.Configuration = {
    mode: 'production',
    target: 'node',
    entry: entryItems,
    devtool: 'source-map',
    node: {
        __dirname: false
    },
    module: {
        rules: [
            {
                // JupyterServices imports node-fetch using `eval`.
                test: /@jupyterlab[\\\/]services[\\\/].*js$/,
                use: [
                    {
                        loader: path.join(__dirname, 'loaders', 'fixEvalRequire.js')
                    }
                ]
            }            
        ]
    },
    externals: [
        'vscode',
        'commonjs'
    ],
    plugins: [
        ...getDefaultPlugins('dependencies'),
        // vsls requires our package.json to be next to node_modules. It's how they
        // 'find' the calling extension.
        new copyWebpackPlugin([
            { from: './package.json', to: '.' }
        ]),
        // onigasm requires our onigasm.wasm to be in node_modules
        new copyWebpackPlugin([
            { from: './node_modules/onigasm/lib/onigasm.wasm', to: './node_modules/onigasm/lib/onigasm.wasm' }
        ])
    ],
    resolve: {
        extensions: ['.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};

// tslint:disable-next-line:no-default-export
export default config;
