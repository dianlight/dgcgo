import { boot } from 'quasar/wrappers'
import { GlobalEventBus } from '@dianlight/gcodego-core'


declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $globalEventBus: GlobalEventBus;
  }
}


const _globalEventBus = new GlobalEventBus()
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app, /*, router, ...*/ }) => {
  app.config.globalProperties.$globalEventBus = _globalEventBus;
})

export const $globalEventBus = _globalEventBus;
