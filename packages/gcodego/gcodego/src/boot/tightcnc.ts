import { boot } from 'quasar/wrappers';
import { Client } from 'src/tightcnc/TightCNC';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $tightcnc: Client;
  }
}


export default boot(async ({ app,/* router, store*/ }) => {

  app.config.globalProperties.$tightcnc = await Client.loadConfig().then( config =>  Client.start(config));
  // ^ ^ ^ this will allow you to use this.$tightcnc (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

//  console.log('*!*!*!*!**!*!*!*!**!', app.config.globalProperties.$tightcnc )

});

//export { tightcnc };
