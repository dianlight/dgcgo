import { boot } from 'quasar/wrappers'
import { createDynamicForms } from '@asigloo/vue-dynamic-forms';

const VueDynamicForms = createDynamicForms();
// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli/boot-files
export default boot( ( { app } ) => {
  app.use(VueDynamicForms)
})
