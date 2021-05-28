<!--route>
{
  "props": true
}
</route-->

<template>
  <!--h1 v-if="$props.url">File: {{ $props.url }}</h1-->
  <vue-3-gcode-viewer
    :gcode="gcode"
    :gcgrid="true"
    :dark-mode="$q.dark.isActive"
    @onprogress='progress'
  />
</template>

<script lang="ts">
//import i18n, { setI18nLanguage } from "@/i18n";
import Vue3GcodeViewer from 'components/Vue3GcodeViewer.vue'
import { Options, Vue } from 'vue-class-component';
//import { useQuasar } from 'quasar'

class Props {
  url = '';
}

@Options({
  components: { Vue3GcodeViewer },
  layout:{
    name: 'default',
    props: {
      title: 'Ciao Bello'
    }
  }
})
export default class WorkBench extends Vue.with(Props) {

  //$q = useQuasar()

  gcode = ''

   mounted(): void {
        void fetch('/demo/Gerber_TopLayer.GTL_iso_combined_cnc.nc')
    //   fetch('/demo/boomerangv4.ncc') // ARCH Commands
    //    fetch('/demo/Griffin Relief.ncc')
    //    fetch('/demo/HomeSwitchRearPanelEngrave.NCC')  // ARCH Commands - White
    //    fetch('/demo/SupportLogo.NCC')  // ARCH Commands  - White
    //    fetch('/demo/gcode-5-40.gcode')  // ARCH Commands - Too BIG - Error
    //    fetch('/demo/arch.ncc')  // ARCH Commands
    //    fetch('/demo/simpletest.nc')
        .then(res => res.blob())
        .then( async blob => {
          this.gcode = await blob.text()
          console.log('Letto GCODE!', this.gcode.length);
        });
    // console.log(this.gcode);
  }

  progress(progress:number){
    if(progress == 0)this.$q.loadingBar.start()
    else if(progress == 100)this.$q.loadingBar.stop()
    else this.$q.loadingBar.increment(progress)
  }

  //changeLanguage(lang: string): void {
  //  setI18nLanguage(i18n, lang);
  //}

  //done(): void {
  //  //    this.progress.visible = false;
  //}

  //update(progress: number): void {
  //  //    this.progress.value = progress;
  //}
}
</script>

<style scoped>
h1 {
  float: left;
}

</style>
