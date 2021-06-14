<template>
  <q-page padding ref="page"> 
    <div class="row wrap justify-start items-start content-start" style="height:80vh;" _style="`min-height:${viewPortHight()}px; max-height:${viewPortHight()}px`">
      <vue-3-gcode-viewer
        :gcode="gcode"
        :gcgrid="true"
        :dark-mode="$q.dark.isActive"
        @onprogress='progress'
      />
    </div>
  </q-page>    
</template>

<script lang="ts">

import Vue3GcodeViewer from 'components/Vue3GcodeViewer.vue'
import { Options, Vue } from 'vue-class-component';

export interface WorkBenchSessionData {
    id:string,
    name:string, // Tab Name
    fileName: string,
    fullPath: string,
    gcode?:string
}

class Props {
  xid = '';
}

@Options({
  components: { Vue3GcodeViewer },
  layout:{
    name: 'default',
    props: {
      title: 'Ciao Bello'
    }
  },
  watch:{
    '$route.params.id'(id:string){
      console.log('File Opened:',(this as WorkBench).$route.params.id);
      (this as WorkBench).wdata = (this as WorkBench).$q.sessionStorage.getItem<WorkBenchSessionData[]>('openFiles')?.find( (value)=>value.id === id)|| {};
      (this as WorkBench).gcode = (this as WorkBench).wdata.gcode || ''
      //console.log((this as WorkBench).wdata,(this as WorkBench).gcode)
    }
  }
})
export default class WorkBench extends Vue.with(Props) {

  //$q = useQuasar()
  id=''

  wdata:Partial<WorkBenchSessionData> = {}

  gcode = ''

   mounted(): void {
     console.log('File Opened:',this.$route.params.id)
     //console.log('Data from LocalSession', this.$q.sessionStorage.getItem<WorkBenchSessionData[]>('openFiles'))
     this.wdata = this.$q.sessionStorage.getItem<WorkBenchSessionData[]>('openFiles')?.find( (value)=>value.id === this.$route.params.id)|| {}
     this.gcode = this.wdata.gcode || ''
     console.log(this.wdata,this.gcode)
  /*
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
    */
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
