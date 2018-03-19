const path = require('path');
let StatsPlugin = require('stats-webpack-plugin');

let config = {
    resolve: {
        extensions: ['.js', '.json'],
    },
    entry: [
        path.resolve(__dirname, 'src/index.js'), // Defining path seems necessary for this to work consistently on Windows machines.
    ],
    module: {
        rules: [
            { test: /\.json/, loader: 'json-loader' },
            {
                test: /\.js?$/,
                exclude: /node_modules/,
                use: ['babel-loader'],
            },
        ],
    },
    output: {
        filename: 'chat-engine.js',
        library: 'ChatEngineCore',
        libraryTarget: 'umd',
    },
    profile: true
};

module.exports = config;
