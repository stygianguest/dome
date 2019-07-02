const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: {
        pong: './src/Pong.js',
        index: './src/index.js',
        param: './src/param.js'
    },
    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name]_bundle.js'
    },
    module: {
      rules: [
        {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader"
            },
        },
        {
            test: /\.css$/,
            use: ["style-loader", "css-loader"]
        },
        {
            test: /\.(png|svg|jpg|gif)$/,
            use: ["file-loader"]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/index.html",
        chunks: ['index'],
        filename: './index.html'
      }),
      new HtmlWebpackPlugin({
        template: "./src/param.html",
        chunks: ['param'],
        filename: './param.html'
      })
    ],
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: 8080
    }
};
