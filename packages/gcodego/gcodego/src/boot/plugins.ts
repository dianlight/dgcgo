import { boot } from 'quasar/wrappers'
import { PluginAdapter } from '../plugins/PluginAdapter'
import { registerInternalPlugins } from '../plugins'


declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $plugins: PluginAdapter;
  }
}
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app, /*, router, ...*/ }) => {
  const pluginAdapter = new PluginAdapter(app.config.globalProperties.$tightcnc,app.config.globalProperties.$globalEventBus);
  registerInternalPlugins(pluginAdapter)
  void pluginAdapter.reloadPlugins()
  app.config.globalProperties.$plugins = pluginAdapter
})
