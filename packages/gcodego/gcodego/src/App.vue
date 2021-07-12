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
  this.$globalEventBus.addListener(GlobalEventBus.NEW_ROUTE,(route: RouteRecordRaw)=>{
    this.$router.addRoute('plugins',route)
    console.log('Adding Routes!',this.$router.getRoutes())
  })
  this.$globalEventBus.addListener(GlobalEventBus.DEL_ROUTE,(routeName: string)=>{
    this.$router.removeRoute(routeName)
  })
 }

}
</script>
