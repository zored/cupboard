var webpack = require('webpack');

module.exports = {
    entry: './assets/ts/main.ts',
    output: {
        filename: './web/js.js'
    },
    devtool: 'source-map',
    resolve: {
        extensions: [
            '',
            '.webpack.js',
            '.web.js',
            '.ts',
            '.js'
        ]
    },
    plugins: [
        // new webpack.optimize.UglifyJsPlugin()
    ],
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    }
};