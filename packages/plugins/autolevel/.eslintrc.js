const path = require('path');
const rootPath = path.resolve(__dirname, "./");

module.exports = {
    parserOptions: {
        project: rootPath + '/tsconfig.eslint.json',
    }
}