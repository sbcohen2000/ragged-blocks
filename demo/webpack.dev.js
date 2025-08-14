const path = require('path');
const common = require("./webpack.common.js");

module.exports = {
    mode: 'development',
    devServer: {
        static: {
            directory: path.resolve(__dirname, 'www'),
        }
    },
    devtool: 'source-map',
    ...common
};
