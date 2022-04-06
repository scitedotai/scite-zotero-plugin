// tslint:disable:no-console

import * as webpack from 'webpack'
import * as path from 'path'
import * as fs from 'fs'

import CircularDependencyPlugin = require('circular-dependency-plugin')
import PostCompile = require('post-compile-webpack-plugin')

import 'zotero-plugin/make-dirs'
import 'zotero-plugin/copy-assets'
import 'zotero-plugin/rdf'
import 'zotero-plugin/version'

const target_dir = 'build/content'
const webpack_js = 'webpack.js'

const config = {
  mode: 'development',
  devtool: false,
  optimization: {
    flagIncludedChunks: true,
    occurrenceOrder: false,
    usedExports: true,
    minimize: false,
    concatenateModules: false,
    noEmitOnErrors: true,
    namedModules: true,
    namedChunks: true,
    runtimeChunk: {
      name: 'webpack',
    },
  },

  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx'],
  },

  node: { fs: 'empty' },

  resolveLoader: {
    alias: {
      'json-jsesc-loader': 'zotero-plugin/loader/json',
    },
  },
  externals: {
    'zotero/itemTree': 'commonjs zotero/itemTree',
  },
  module: {
    rules: [
      { test: /\.json$/, type: 'javascript/auto', use: [ 'json-jsesc-loader' ] }, // https://github.com/webpack/webpack/issues/6572
      { test: /\.ts$/, exclude: [ /node_modules/ ], use: [ 'ts-loader' ] },
      {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              cacheCompression: false,
            }
          }
      }
    ],
  },

  plugins: [
    new CircularDependencyPlugin({ failOnError: true }),
    new PostCompile(() => {
      const wrapped_webpack = `${target_dir}/${webpack_js}`
      if (fs.existsSync(wrapped_webpack)) {
        let js = fs.readFileSync(`${target_dir}/${webpack_js}`, 'utf-8')

        const prefix = 'if (!Zotero.WebPackedScite) {\n\n'
        const postfix = '\n\n}\n'

        if (!js.startsWith(prefix)) js = `${prefix}${js}${postfix}`

        fs.writeFileSync(`${target_dir}/${webpack_js}`, js)

      } else {
        console.log(`${wrapped_webpack} does not exist -- compilation error?`)

      }
    }),
  ],

  context: path.resolve(__dirname, './content'),

  entry: {
    Scite: './scite.ts',
    'Scite.zoteroPane': './zoteroPane.ts',
    'Scite.itemPane': './itemPane.ts',
  },

  output: {
    globalObject: 'Zotero',
    path: path.resolve(__dirname, `./${target_dir}`),
    filename: '[name].js',
    jsonpFunction: 'WebPackedScite',
    devtoolLineToLine: true,
    pathinfo: true,
    library: 'Zotero.[name]',
    libraryTarget: 'assign',
  },
}

export default config
