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
        <q-separator vertical inset />

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

        <q-separator vertical inset />

        <div>Quasar <q-badge>v{{ $q.version }}</q-badge></div>

        <q-separator vertical inset />

        <q-badge rounded :color="lastStatus?.controller?.ready?'green':'yellow'" v-if="lastStatus?.controller">
          <q-tooltip>
          {{ lastStatus?.controller }}
          </q-tooltip>
        </q-badge> 
        <q-badge rounded color="red" v-if="lastStatus?.controller?.error">
          <q-tooltip>
          {{ lastStatus?.controller?.errorData/*.message*/ }}
          </q-tooltip>
        </q-badge> 
        <q-badge rounded :color="clientExists?'yellow':'red'" v-if="!lastStatus?.controller">
          <q-tooltip>
            TightCNC Server connection error! 
          </q-tooltip>
        </q-badge>  

      </q-toolbar>

      <q-tabs align="center">
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
      <command-widget/>
      <status-widget/>
      <control-widget/>

<!--
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
-->        
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer elevated class="bg-secondary">
      {{ lastStatus?.controller }}
      <!--
      <q-toolbar>
        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo/svg/quasar-logo.svg">
          </q-avatar>
          <div>Title</div>
        </q-toolbar-title>
      </q-toolbar>
      -->
    </q-footer>

  </q-layout>
</template>

<script lang="ts">
import EssentialLink from 'components/EssentialLink.vue'
import StatusWidget from '../components/StatusWidget.vue'
import ControlWidget from '../components/ControlWidget.vue'
import CommandWidget from '../components/CommandWidget.vue'


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
  components: { EssentialLink, StatusWidget, ControlWidget, CommandWidget },
  watch: {
    '$store.state.tightcnc.lastStatus.controller'(value) {
      if(!value){
        console.log('Cambiato Controller Nullo!',this,value);
        (this as MainLayout).clientExists=!(this as MainLayout).clientExists
      } else if(!(this as MainLayout).clientExists){
        (this as MainLayout).clientExists=true
      }
    }
  }
})
export default class MainLayout extends Vue {

  clientExists = false

  locale = useI18n({useScope: 'global'}).locale
  get lastStatus(){
    return this.$store.state.tightcnc.lastStatus
  }

  leftDrawerOpen = true;
  essentialLinks = linksList;
  toggleLeftDrawer () {
    this.leftDrawerOpen = !this.leftDrawerOpen
  }

  localeOptions = [
    { value: 'en', label: 'English'},
    { value: 'it', label: 'Italiano'}
  ]

  mounted(){
      const starter = setInterval(()=>{
        if(this.$tightcnc){
          void this.$store.dispatch('tightcnc/clientStatus', this.$tightcnc)
          this.clientExists=true
          clearInterval(starter)
        }
        this.clientExists=!this.clientExists
      },1000)
  }
}
</script>
