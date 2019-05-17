// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const constants_1 = require("../constants");
const common_1 = require("./common");
const copyWebpackPlugin = require("copy-webpack-plugin");
const entryItems = {};
common_1.nodeModulesToExternalize.forEach(moduleName => {
    entryItems[`node_modules/${moduleName}`] = `./node_modules/${moduleName}`;
});
const config = {
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
        ...common_1.getDefaultPlugins('dependencies'),
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
        path: path.resolve(constants_1.ExtensionRootDir, 'out', 'client'),
        libraryTarget: 'commonjs2',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    }
};
// tslint:disable-next-line:no-default-export
exports.default = config;
