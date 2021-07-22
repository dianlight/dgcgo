<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" height-hint="98">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
          </q-avatar>
          Q3DViewer - Demo Application
        </q-toolbar-title>

        <q-btn dense flat round icon="menu" @click="toggleRightDrawer" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <!-- drawer content -->
    </q-drawer>

    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered>
      <!-- drawer content -->
    </q-drawer>

    <q-page-container style="height:100vh;">
      <Q3DViewer
        :gcode="gcode"
        :gcgrid="false"
        :dark-mode="$q.dark.isActive"
        :current-line="currentLine"
        :cursor-position="cursorPosition"
        :machine-surface="machineSurface"
        :machine-offset="machineOffset"
        :home-direction="homeDirection"
        @onprogress='progress'
      >
          <q-btn-group v-if="gcode" outline>
            <q-btn outline dense icon='play_arrow'>
              <q-tooltip>Start Job</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='restart_alt'>
              <q-tooltip>Restart</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='pause'>
              <q-tooltip>Pause</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='arrow_right'>
              <q-tooltip>Resume</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='contact_support'>
              <q-tooltip>Action required</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='stop' disable>
              <q-tooltip>Stop</q-tooltip>
            </q-btn> 
          </q-btn-group>
      </Q3DViewer>
    </q-page-container>

    <q-footer elevated class="bg-grey-8 text-white">
      <q-toolbar>
        <q-toolbar-title>
          <q-avatar>
            <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
          </q-avatar>
          <div>Footer</div>
        </q-toolbar-title>
      </q-toolbar>
    </q-footer>

  </q-layout>
</template>

<script lang="ts">
import { Vue, Options } from 'vue-property-decorator'
import Q3DViewer from '../components/Q3DViewer.vue'
//import { useQuasar, QToolbar, QTabs, QHeader, QDrawer, QBtn, QAvatar, QToolbarTitle, QPageContainer, QFooter, QLayout } from 'quasar'

@Options({
  components: { Q3DViewer },
})
export default class App extends Vue {
  leftDrawerOpen = true
  rightDrawerOpen = false

  currentLine = 0
  gcode = ''
  cursorPosition = [0,0,0]
  machineSurface = [160,100,45]
  machineOffset = [0,0,0]
  homeDirection = ['-','-','+']


  toggleLeftDrawer () {
        this.leftDrawerOpen = !this.leftDrawerOpen
      }

    
      toggleRightDrawer () {
        this.rightDrawerOpen = !this.rightDrawerOpen
      }


  progress (progress: number) {
    console.log(progress)
  } 
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
#nav {
  padding: 30px;
  a {
    font-weight: bold;
    color: #2c3e50;
    &.router-link-exact-active {
      color: #42b983;
    }
  }
}
</style>