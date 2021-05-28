<template>
  <router-view />
</template>
<script lang="ts">
import { Vue } from 'vue-class-component'
import * as TightCNC from './tightcnc/TightCNC'

export default class App extends Vue {

    mounted(){
        // Autostart TightCNC
        void TightCNC.Client.start({}).then((client)=> this.$store.dispatch('tightcnc/clientStatus', client))
    }

}
</script>
