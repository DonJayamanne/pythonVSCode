var path = require('path');
var browserPath = path.join(__dirname, 'src', 'client', 'jupyter', 'browser');
module.exports = {
    context: browserPath,
    node: {
        __filename: false,
        // If this is not used then __dirname in bundled scripts is set to / and mathajax-electron
        // https://github.com/nteract/mathjax-electron/blob/master/src/mathjax-electron.js#L22
        // script.src = path.join(__dirname, "..", "resources", "MathJax", "MathJax.js?delayStartupUntil=configured");
        __dirname: false
    },
    entry: path.join(browserPath, 'main.ts'),
    output: {
        filename: path.join(__dirname, 'out', 'client', 'jupyter', 'browser', 'bundle.js'),
        publicPath: browserPath
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