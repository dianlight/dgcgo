import { boot } from 'quasar/wrappers'
import shortkey from 'vue3-shortkey'

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot(({ app } /*, router, ... } */ ) => {
    app.use(shortkey)
})