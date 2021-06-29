const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const TerserPlugin = require('terser-webpack-plugin')
const nodeExternals = require('webpack-node-externals');


const serverConfig = (env, argv) => {
    var config = {
        target: 'node14',
        externals: [nodeExternals()],
        //    devtool: 'inline-source-map',
        entry: {
            server: './src/server/server.ts',
            //            consoleui: './src/consoleui/consoleui.ts',
        },
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            }, ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                'pty.js': false,
                'vertx': false
            }
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'server'),
            clean: true,
        },
        plugins: [
            new NodePolyfillPlugin(),
            new WebpackManifestPlugin({}),
        ]
    };
    if (argv.mode === 'development') {
        config.devtool = 'eval-cheap-module-source-map';
    }

    if (argv.mode === 'production') {
        config.plugins.push(new TerserPlugin({
            parallel: true,
            terserOptions: {
                ecma: 6,
            }
        }))
        config.plugins.push(new WebpackManifestPlugin({}))
    }
    return config;
}
const pluginsConfig = (env, argv) => {
    var config = {
        target: 'node14',
        externals: [nodeExternals()],
        entry: {
            "tool-change": './src/plugins/tool-change.ts',
            "job-recovery": './src/plugins/job-recovery.ts',
            "move-splitter": './src/plugins/move-splitter.ts',
            "runtime-override": './src/plugins/runtime-override.ts',
            "autolevel": './src/plugins/autolevel.ts',
        },
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            }, ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                'pty.js': false
            }
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'plugins'),
            clean: true,
        },
        plugins: [
            new NodePolyfillPlugin(),
            new WebpackManifestPlugin({}),
        ]
    };
    if (argv.mode === 'development') {
        config.devtool = 'eval-cheap-module-source-map';
    }

    if (argv.mode === 'production') {
        config.plugins.push(new TerserPlugin({
            parallel: true,
            terserOptions: {
                ecma: 6,
            }
        }))
        config.plugins.push(new WebpackManifestPlugin({}))
    }
    return config;
}

const clientConfig = (env, argv) => {
    var config = {
        //    experiments: {
        //        outputModule: true,
        //    },
        target: ['web'],
        entry: {
            clientlib: './lib/clientlib.ts',
        },
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            }, ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist', 'client'),
            clean: true,
            globalObject: 'this',
            //        module: true,
            library: {
                type: 'umd',
                name: '[name]'
            }
        },
        plugins: [

        ]
    };

    if (argv.mode === 'development') {
        config.devtool = 'eval-cheap-module-source-map';
    }

    if (argv.mode === 'production') {
        config.plugins.push(new TerserPlugin({
            parallel: true,
            terserOptions: {
                ecma: 6,
            }
        }))
        config.plugins.push(new WebpackManifestPlugin({}))
    }
    return config;
}

module.exports = [serverConfig /*, clientConfig*/ /*,pluginsConfig*/ ]