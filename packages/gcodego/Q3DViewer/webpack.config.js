const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')
//const WatchIgnorePlugin = require('watch-ignore-webpack-plugin');

const rootPath = path.resolve(__dirname, "./");
const srcPath = path.resolve(rootPath, "src");
const libPath = path.resolve(rootPath, "dist/src");

module.exports = {
  entry: srcPath + "/index.ts",
  output: {
    path: libPath,
    filename: "index.js",
    library: {
      name: "Q3DViewer",
      type: "umd",
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader",
        exclude: /node_modules/
      },
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          configFile: 'tsconfig.json'
        }
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      }
    ]
  },
  plugins: [new VueLoaderPlugin({
    //compilerSfc: true
  }), new CleanWebpackPlugin(), new NodePolyfillPlugin(), new webpack.WatchIgnorePlugin({
    paths: [/\.js$/,/\.d\.ts$/]
  })],
  resolve: {
    extensions: [".ts", ".js", ".vue"],
    alias: {
      'fs': false
    }
  },
  externals: {
    // define module 'vue' which will point to window.Vue in result bundle
    vue: "vue",
    compilerSfc: "@vue/compiler-sfc",
    quasar:"quasar"
  }
};