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
        <!--  Quasar App -->
        </q-toolbar-title>
        
        <q-separator vertical inset />

        <menu-widget/>

        <q-separator vertical inset />

        <div>Quasar <q-badge>v{{ $q.version }}</q-badge></div>
         <q-toggle
            v-model="debug"
            color="green"
            icon="adb"
            size="xs"
          />


        <q-separator vertical inset />

        <q-badge rounded :color="lastStatus?.controller?.ready?'green':'yellow'" v-if="lastStatus?.controller && !lastStatus?.controller?.error">
          <!--q-tooltip>
          {{ lastStatus?.controller }}
          </!--q-tooltip-->
        </q-badge> 
        <q-badge rounded color="red" v-if="lastStatus?.controller?.error">
          <q-tooltip >
          {{ lastStatus?.controller?.errorData?.message || lastStatus?.controller?.errorData}}
          </q-tooltip>
        </q-badge> 
        <q-badge rounded :color="clientExists?'yellow':'red'" v-if="!lastStatus?.controller">
          <q-tooltip>
            TightCNC Server connection error! 
          </q-tooltip>
        </q-badge>  

      </q-toolbar>

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
 
    </q-drawer>

    <!-- Dialogs -->
    <preferences/>
    <!-- /Dialogs -->

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer elevated class="bg-secondary" v-if="debug">
      <code class='mini text-white'>{{ $store.state.tightcnc?.lastStatus}}</code>
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
import Preferences from '../dialogs/Preferences.vue'
import StatusWidget from '../components/StatusWidget.vue'
import ControlWidget from '../components/ControlWidget.vue'
import CommandWidget from '../components/CommandWidget.vue'
import MenuWidget from '../components/MenuWidget.vue'




import { Vue, Options } from 'vue-class-component'
import { SerializedError } from 'new-error'
//import * as _ from 'lodash'


@Options({
  components: { MenuWidget, StatusWidget, ControlWidget, CommandWidget, Preferences },
  watch: {
    '$store.state.tightcnc.lastStatus.controller'(value) {
      if(!value){
        //console.log('Cambiato Controller Nullo!',this,value);
        (this as MainLayout).clientExists=!(this as MainLayout).clientExists
      } else if(!(this as MainLayout).clientExists){
        (this as MainLayout).clientExists=true
      }
    },
    '$store.state.tightcnc.lastStatus.controller.errorData'(errorData?:SerializedError,oldErrorData?:SerializedError) {
      if(errorData && JSON.stringify(errorData) !== JSON.stringify(oldErrorData)){
 //         console.log(JSON.stringify(errorData),JSON.stringify(oldErrorData))
          const color = errorData.logLevel === 'error'?'negative':'warning';
//          console.error(errorData);


//        switch(errorData.getSubCode()){
//          case 'GG' /* ERRORCODES.LIMIT_HIT.subCode*/:
            (this as MainLayout).$q.notify({
              caption: errorData.name,
              message: `${errorData.message} <br/> ${JSON.stringify(errorData.meta,undefined,'<br/>')}`,
              color: color,
              position: 'bottom-right',
              html: true,
              icon: 'announcement',
//              actions: [
//                { label: 'Reply', color: 'yellow', handler: () => { /* ... */ } },
//                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
//              ]          
            })
/*            break;
          default:
            (this as MainLayout).$q.notify({
              message: errorData.toJSON().message,
              color: 'accent',
              icon: 'announcement',
              actions: [
                { label: 'Reply', color: 'yellow', handler: () => { / * ... * / } },
                { label: 'Dismiss', color: 'white', handler: () => { / * ... * / } }
              ]          
            })
            break;  
        }
        */
      }
    }, 
    '$store.state.tightcnc.lastStatus.job.error'(error?:string,oldError?:string) {
//      console.log(errorData)
      if(error && error !== oldError){
            (this as MainLayout).$q.notify({
              caption: 'Job Error',
              message: error,
              color: 'accent',
              position: 'bottom-right',
              icon: 'announcement',
//              actions: [
//                { label: 'Reply', color: 'yellow', handler: () => { /* ... */ } },
//                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
//              ]          
            })
      }
    }
  }
})
export default class MainLayout extends Vue {

  clientExists = false
  debug = false

//  locale = useI18n({useScope: 'global'}).locale
   get lastStatus(){
     return this.$store.state.tightcnc.lastStatus
   }

  leftDrawerOpen = true;
  toggleLeftDrawer () {
    this.leftDrawerOpen = !this.leftDrawerOpen
  }

  override mounted(){
     console.log('Current This is:',this)
      const starter = setInterval(()=>{
        if(this.$tightcnc){
          void this.$store.dispatch('tightcnc/clientStatus', this.$tightcnc)
          void this.$store.dispatch('tightcnc/logReader', this.$tightcnc)
          this.clientExists=true
          clearInterval(starter)
        }
        this.clientExists=!this.clientExists
      },1000)
  }
}
</script>

<style lang="scss" scoped>
.mini {
    font-size: small;
    font-family: ui-monospace;
}
</style>
