<template>
  <router-view />
</template>
<script lang="ts">
import { GlobalEventBus } from '@dianlight/gcodego-core'
import {RouteRecordRaw  } from 'vue-router'
import { Vue } from 'vue-class-component'

export default class App extends Vue {

//   mounted(){
//     console.debug('Client=>',this.$tightcnc);
//    }

 override created(){
  this.$tightcnc.notify = (arg)=>this.$q.notify(arg);  // TODO: This fix a undocumented BUG in Quasar Notify v 2.0.2. Try to remove in future versions
  this.$globalEventBus.addListener(GlobalEventBus.NEW_ROUTE,(route: RouteRecordRaw)=>{
    this.$router.addRoute('plugins',route)
    console.log('Adding Routes!',this.$router.getRoutes())
  })
  this.$globalEventBus.addListener(GlobalEventBus.DEL_ROUTE,(routeName: string)=>{
    this.$router.removeRoute(routeName)
  })
  this.$globalEventBus.addListener(GlobalEventBus.NOTIFY, (opts)=>{
    this.$q.notify(opts)
  })
 }

}
</script>
