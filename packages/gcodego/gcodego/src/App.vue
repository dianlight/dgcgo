<template>
  <router-view />
</template>
<script lang="ts">
import { Vue } from 'vue-class-component'

export default class App extends Vue {

    mounted(){
      console.debug('Client=>',this.$tightcnc);
    }

}
</script>
