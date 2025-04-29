const path = require('path');

module.exports = {
  target: 'node',
  entry: './extension.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // Ignoriert das 'vscode'-Modul
  },
  resolve: {
    extensions: ['.js']
  }
}; 