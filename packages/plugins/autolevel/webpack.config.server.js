const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
//const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const rootPath = path.resolve(__dirname, "./");
const srcPath = path.resolve(rootPath, "src/server");
const libPath = path.resolve(rootPath, "dist/src/server");

module.exports = {
  entry: srcPath + "/index.ts",
  target: 'node14',
  output: {
    path: libPath,
    filename: "index.js",
    library: {
      name: "Autolevel",
      type: "umd",
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
//          transpileOnly: true,
          configFile: 'tsconfig.server.json'
//          appendTsSuffixTo: [/\.vue$/]
        }
      }
    ]
  },
  plugins: [new CleanWebpackPlugin(),new ForkTsCheckerWebpackPlugin({
    typescript: {
      configFile: "tsconfig.server.json",
//      extensions: {
//        vue: {
//          enabled: true,
//          compiler: "@vue/compiler-sfc"
//        }
//      }
    },
    eslint: {
      files: './src/server/**/*.ts' // required - same as command `eslint ./src/**/*.{ts,tsx,js,jsx} --ext .ts,.tsx,.js,.jsx`
    }
  }),new webpack.WatchIgnorePlugin({
    paths: [/\.js$/,/\.d\.ts$/]
  })],
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      'pty.js': false,
      'vertx': false
    }
  },
  externals: {
    // define module 'vue' which will point to window.Vue in result bundle
  }
};