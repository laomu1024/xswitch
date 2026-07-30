const path = require('path');
const { rspack } = require('@rspack/core');

const isDev = process.env.RSPACK_DEV === '1';

const swcTsRule = {
  test: /\.ts$/,
  exclude: /node_modules/,
  type: 'javascript/auto',
  use: [
    {
      loader: 'builtin:swc-loader',
      options: {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
        },
      },
    },
  ],
};

const swcTsxRule = {
  test: /\.tsx$/,
  type: 'javascript/auto',
  use: [
    {
      loader: 'builtin:swc-loader',
      options: {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            legacyDecorator: true,
            react: {
              runtime: 'automatic',
              development: isDev,
              refresh: false,
            },
          },
        },
      },
    },
  ],
};

const lessRule = {
  test: /\.less$/,
  type: 'css/auto',
  use: ['less-loader'],
};

const cssRule = {
  test: /\.css$/,
  type: 'css/auto',
};

const baseModule = {
  rules: [swcTsxRule, swcTsRule, lessRule, cssRule],
};

const devConfig = {
  mode: 'development',
  entry: {
    xswitch: path.resolve(__dirname, 'src/app.tsx'),
    background: path.resolve(__dirname, 'src/background.ts'),
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js',
    publicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: baseModule,
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
  devServer: {
    port: 8088,
    open: ['/'],
    static: [
      {
        directory: path.resolve(__dirname, 'lib'),
        publicPath: '/lib',
      },
      {
        directory: path.resolve(__dirname, 'images'),
        publicPath: '/images',
      },
      {
        directory: path.resolve(__dirname, 'dev'),
        publicPath: '/',
      },
    ],
    historyApiFallback: {
      rewrites: [
        { from: /^\/XSwitch\.html$/, to: '/index.html' },
      ],
    },
  },
  devtool: 'cheap-module-source-map',
  target: 'web',
};

const prodConfig = {
  mode: 'production',
  entry: {
    background: path.resolve(__dirname, 'src/background.ts'),
    xswitch: path.resolve(__dirname, 'src/pages/xswitch/main.ts'),
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: (pathData) => (
      pathData.chunk?.name === 'background' ? 'background.min.js' : '[name].js'
    ),
    cssFilename: '[name].css',
    cssChunkFilename: '[name].css',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: baseModule,
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
  ],
  target: 'web',
};

module.exports = isDev ? devConfig : prodConfig;
