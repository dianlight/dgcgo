const uiConfig = require("./webpack.config.js");

module.exports = (env, argv) => {
  uiConfig.mode = argv.mode;

  if (argv.mode === "development") {
    uiConfig.devtool = "inline-source-map";
//    uiConfig.watch = true;
  }

  if (argv.mode === "production") {
    uiConfig.devtool = "source-map";
  }

  return uiConfig;
};