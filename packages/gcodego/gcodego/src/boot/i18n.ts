import { boot } from 'quasar/wrappers';
import { createI18n, LocaleMessages, VueMessageType } from 'vue-i18n';

//import messages from 'src/i18n';


/**
 * Load locale messages
 * 
 * The loaded `JSON` locale messages is pre-compiled by `@intlify/vue-i18n-loader`, which is integrated into `vue-cli-plugin-i18n`.
 * See: https://github.com/intlify/vue-i18n-loader#rocket-i18n-resource-pre-compilation
 */
function loadLocaleMessages(): LocaleMessages<VueMessageType> {
  const messages: LocaleMessages<VueMessageType> = {}
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const locales = require.context('../i18n', true, /[A-Za-z0-9-_,\s]+\.json$/i)
  console.log(locales)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,  @typescript-eslint/no-unsafe-member-access
    locales.keys().forEach(key => {
      const matched = /([A-Za-z0-9-_]+)\./i.exec(key)
      if (matched && matched.length > 1) {
        const locale = matched[1]
        console.log('Found locale:',locale)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        messages[locale] = locales(key).default
      }
    })
  return messages
}



const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: loadLocaleMessages(),
  globalInjection: true
})

/*
const i18n = createI18n({
  locale: 'en-US',
  messages,
});
*/

export default boot(({ app }) => {
  // Set i18n instance on app
  app.use(i18n);
});

export { i18n };
