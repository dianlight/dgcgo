import { boot } from 'quasar/wrappers';
import { TightCNCClient } from '../tightcnc/TightCNCClient';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $tightcnc: TightCNCClient;
  }
}


export default boot(async ({ app,/* router, store*/ }) => {

  //app.config.globalProperties.$tightcnc = await Client.loadConfig().then( config =>  Client.start(config));
  // ^ ^ ^ this will allow you to use this.$tightcnc (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file
  const client = new TightCNCClient()
  app.config.globalProperties.$tightcnc = client
  await client.loadConfig()
  client.start().catch(err => {
    console.error('Error in starting Server',err)
  })
});
