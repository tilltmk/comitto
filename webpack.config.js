const path = require('path');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  target: 'node',
  entry: {
    extension: './extension.js',
    commands: './commands.js',
    ui: './ui.js',
    utils: './utils.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // Ignoriert das 'vscode'-Modul
  },
  resolve: {
    extensions: ['.js']
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'resources',
          to: 'resources'
        }
      ],
    }),
  ],
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      minSize: 30000,
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          name: 'vendor',
          chunks: 'all',
          enforce: true
        }
      }
    }
  }
}; 