<template>
  <q-page padding ref="page"> 
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-page>      
</template>

<script lang="ts">
/*
import Preferences from '../dialogs/Preferences.vue'
import StatusWidget from '../components/StatusWidget.vue'
import ControlWidget from '../components/ControlWidget.vue'
import CommandWidget from '../components/CommandWidget.vue'
import MenuWidget from '../components/MenuWidget.vue'



*/
//import { GlobalEventBus } from '@dianlight/gcodego-core'
import { Vue } from 'vue-class-component'
//import { RouteRecordRaw } from 'vue-router';
/*
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
//          case 'GG' /* ERRORCODES.LIMIT_HIT.subCode* /:
            (this as MainLayout).$q.notify({
              caption: errorData.name,
              message: `${errorData.message} <br/> ${JSON.stringify(errorData.meta,undefined,'<br/>')}`,
              color: color,
              position: 'bottom-right',
              html: true,
              icon: 'announcement',
//              actions: [
//                { label: 'Reply', color: 'yellow', handler: () => { /* ... * / } },
//                { label: 'Dismiss', color: 'white', handler: () => { /* ... * / } }
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
        * /
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
//                { label: 'Reply', color: 'yellow', handler: () => { /* ... * / } },
//                { label: 'Dismiss', color: 'white', handler: () => { /* ... * / } }
//              ]          
            })
      }
    }
  }
})
*/
export default class PluginSubLayout extends Vue {

/*

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
  */
}
</script>

<style lang="scss" scoped>
</style>
