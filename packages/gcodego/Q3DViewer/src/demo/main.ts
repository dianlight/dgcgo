
import { createApp } from 'vue';
import { Quasar } from 'quasar';
import App from './App.vue';
//import router from './router'
//import store from './store'

console.log(Quasar);

createApp(App)
    .use(Quasar, {
            config: {
                dark: 'auto',
                loadingBar: {
                    position: 'bottom',
                    size: '15px'
                },
                notify: {/* look at QuasarConfOptions from the API card */}
            },
    })
    //.use(router)
    //.use(store)
    .mount('#app')