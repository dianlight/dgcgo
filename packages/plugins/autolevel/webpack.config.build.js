const uiConfig = require("./webpack.config.ui.js");
const severConfig = require("./webpack.config.server.js");

module.exports = [(env, argv) => {
  uiConfig.mode = argv.mode;

  if (argv.mode === "development") {
    uiConfig.devtool = "inline-source-map";
    uiConfig.watch = true;
  }

  if (argv.mode === "production") {
    uiConfig.devtool = "source-map";
  }

  return uiConfig;
}, (env, argv) => {
    severConfig.mode = argv.mode;
    severConfig.stats = {
      errorDetails: true
    }

  if (argv.mode === "development") {
    severConfig.devtool = "inline-source-map";
    severConfig.watch = true;
  }

  if (argv.mode === "production") {
    severConfig.devtool = "source-map";
  }

  return severConfig;
}];