<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo/svg/quasar-logo.svg">
          </q-avatar>
          Quasar App
        </q-toolbar-title>

        <q-select
          v-model="locale"
          :options="localeOptions"
          label="Quasar Language"
          dense
          borderless
          emit-value
          map-options
          options-dense
          style="min-width: 150px"
        />

        <div>Quasar v{{ $q.version }}</div>

        <q-badge rounded color="red" v-if="lastStatus?.controller.error">
          <q-tooltip>
          {{ lastStatus?.controller.errorData.message }}
          </q-tooltip>
        </q-badge> 
        <q-badge rounded color="yellow" />
        <q-badge rounded color="yellow" />

        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleRightDrawer"
        />
      </q-toolbar>

      <q-tabs align="left">
        <q-route-tab to="/" label="Home" />
        <q-route-tab to="/workbench" label="Workbanch" />
        <q-route-tab to="/terminal" label="Terminal" />
        <q-route-tab to="/preferences" label="Preferences" />
      </q-tabs>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      side="left"
    >
      <q-list>
        <q-item-label
          header
        >
          Essential Links
        </q-item-label>

        <EssentialLink
          v-for="link in essentialLinks"
          :key="link.title"
          v-bind="link"
        />
      </q-list>
    </q-drawer>

    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" elevated>
      <!-- drawer content -->
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer elevated class="bg-secondary">
      <q-toolbar>
        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo/svg/quasar-logo.svg">
          </q-avatar>
          <div>Title</div>
        </q-toolbar-title>
      </q-toolbar>
    </q-footer>

  </q-layout>
</template>

<script lang="ts">
import EssentialLink from 'components/EssentialLink.vue'

const linksList = [
  {
    title: 'Home',
    caption: 'home',
    icon: 'home',
    link: '/'
  },
  {
    title: 'Docs',
    caption: 'quasar.dev',
    icon: 'school',
    link: 'https://quasar.dev'
  },
  {
    title: 'Github',
    caption: 'github.com/quasarframework',
    icon: 'code',
    link: 'https://github.com/quasarframework'
  },
  {
    title: 'Discord Chat Channel',
    caption: 'chat.quasar.dev',
    icon: 'chat',
    link: 'https://chat.quasar.dev'
  },
  {
    title: 'Forum',
    caption: 'forum.quasar.dev',
    icon: 'record_voice_over',
    link: 'https://forum.quasar.dev'
  },
  {
    title: 'Twitter',
    caption: '@quasarframework',
    icon: 'rss_feed',
    link: 'https://twitter.quasar.dev'
  },
  {
    title: 'Facebook',
    caption: '@QuasarFramework',
    icon: 'public',
    link: 'https://facebook.quasar.dev'
  },
  {
    title: 'Quasar Awesome',
    caption: 'Community Quasar projects',
    icon: 'favorite',
    link: 'https://awesome.quasar.dev'
  }
];

import { Vue, Options } from 'vue-class-component'
import { useI18n } from 'vue-i18n'

@Options({
  components: { EssentialLink },
})
export default class MainLayout extends Vue {

  locale = useI18n({useScope: 'global'}).locale
  get lastStatus(){
    return this.$store.state.tightcnc.lastStatus
  }

  leftDrawerOpen = true;
  rightDrawerOpen = false;
  essentialLinks = linksList;
  toggleLeftDrawer () {
    this.leftDrawerOpen = !this.leftDrawerOpen
  }

  toggleRightDrawer () {
    this.rightDrawerOpen = !this.rightDrawerOpen
  }

  localeOptions = [
    { value: 'en', label: 'English'},
    { value: 'it', label: 'Italiano'}
  ]


}
</script>
