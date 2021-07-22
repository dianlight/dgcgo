const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')

const rootPath = path.resolve(__dirname, "./");
const srcPath = path.resolve(rootPath, "src/ui");
const libPath = path.resolve(rootPath, "dist/src/ui");

module.exports = {
  entry: srcPath + "/index.ts",
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
        test: /\.vue$/,
        use: "vue-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.ts$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          configFile: 'tsconfig.ui.json'
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
  plugins: [new VueLoaderPlugin(), new CleanWebpackPlugin(), new NodePolyfillPlugin(),new webpack.WatchIgnorePlugin({
    paths: [/\.js$/,/\.d\.ts$/]
  })],
  resolve: {
    extensions: [".ts", ".js", ".vue"]
  },
  externals: {
    // define module 'vue' which will point to window.Vue in result bundle
    vue: "vue",
    compilerSfc: "@vue/compiler-sfc",
  }
};