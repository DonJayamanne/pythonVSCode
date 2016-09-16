var path = require('path');
var browserPath = path.join(__dirname, 'src', 'client', 'jupyter', 'browser');
module.exports = {
    //context: browserPath,
    entry: path.join(browserPath, 'main.ts'),
    output: {
        filename: path.join(__dirname, 'out', 'client', 'jupyter', 'browser', 'bundle.js')
    },
    resolve: {
        root: browserPath,
        extension: ['', '.ts']
    },
    module: {
        loaders: [
            { test: /\.json$/, loader: 'ignore-loader' },
            {
                test: /.ts$/, loader: 'ts-loader',
                exclude: /\.json$/,
                include: browserPath
            },
            {
                test: /.js/,
                exclude: /\.json$/,
                loader: 'babel-loader',
                query: {
                    presets: 'es2015',
                }
            }
        ]
    }
}