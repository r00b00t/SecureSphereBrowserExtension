import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    popup: './popup.js',
    background: './background.js',
    content: './content.js'
  },
  experiments: {
    outputModule: true
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'module'
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.ts'],
    fallback: {
      crypto: false,
      stream: false,
      buffer: false,
      path: false
    },
    alias: {
      '@s5': path.resolve(__dirname, 's5.js/src'),
      'multibase': path.resolve(__dirname, 'node_modules/multibase')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
      // Removed bip39: 'bip39' - Handled by background script
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /.*\.(pem|key|crt|cert)$/,
      contextRegExp: /node_modules/
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /test/,
      contextRegExp: /node_modules.*public-encrypt/
    })
  ],
  mode: 'development'
};
