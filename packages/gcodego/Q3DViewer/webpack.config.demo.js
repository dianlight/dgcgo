const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const rootPath = path.resolve(__dirname, './');
const srcPath = path.resolve(rootPath, 'src');
//const libPath = path.resolve(rootPath, 'dist/src');

module.exports = {
  mode: 'development',
 // devtool = 'inline-source-map',
  entry: srcPath + '/demo/main.ts',
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: 'index_bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          configFile: 'tsconfig.eslint.json',
          transpileOnly: true,
        }
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        exclude: /node_modules/,
        options: {
          loaders: {
            'scss': 'vue-style-loader!css-loader!sass-loader',
            'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
          },
        },        
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        loader: 'url-loader',
        options: {
          limit: 8192,
        },
      },
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'vue-style-loader',
          'scss-loader'
        ]
      }    ]
  },
  plugins: [new VueLoaderPlugin({
    //compilerSfc: true,
    exposeFilename: true,
  }), new CleanWebpackPlugin(),new ForkTsCheckerWebpackPlugin({
    typescript: {
      configFile: "tsconfig.eslint.json",
      extensions: {
        vue: {
          enabled: true,
          compiler: "@vue/compiler-sfc"
        }
      }
    },
    eslint: {
      files: './src/**/*.{ts,vue}' // required - same as command `eslint ./src/**/*.{ts,tsx,js,jsx} --ext .ts,.tsx,.js,.jsx`
    }
  }), new NodePolyfillPlugin(),
    new webpack.WatchIgnorePlugin({
    paths: [/\.js$/,/\.d\.ts$/]
  })],
  resolve: {
    extensions: ['.ts', '.js', '.vue'],
    alias: {
      'fs': false,
  //    'vue$': 'vue/dist/vue.esm.js',
    },
    plugins: [
      new TsconfigPathsPlugin({
        configFile: 'tsconfig.eslint.json',
      }),
    ]  
  },
  externals: {
    // define module 'vue' which will point to window.Vue in result bundle
   // vue: 'vue',
   // compilerSfc: '@vue/compiler-sfc',
   // quasar:'quasar'
  }
};