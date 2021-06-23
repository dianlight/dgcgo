<template>
  <q-page padding ref="page"> 
    <div class="row wrap justify-start items-start content-start" style="height:75vh;" _style="`min-height:${viewPortHight()}px; max-height:${viewPortHight()}px`">
      <vue-3-gcode-viewer
        :gcode="gcode"
        :gcgrid="true"
        :dark-mode="$q.dark.isActive"
        :current-line="$store.state.tightcnc.lastStatus?.job?.stats.lineCount"
        :cursor-position="$store.state.tightcnc.lastStatus?.controller?.pos"
        @onprogress='progress'
      >
          <q-btn-group outline>
            <q-btn outline dense icon='play_arrow' @click="startJob" v-if="!$store.state.tightcnc.lastStatus?.controller?.programRunning">
              <q-tooltip>Start Job</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='restart_alt' v-if="$store.state.tightcnc.lastStatus?.controller?.programRunning">
              <q-tooltip>Restart</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='pause' v-if="($store.state.tightcnc.lastStatus?.controller?.programRunning) &&
                                                    (!$store.state.tightcnc.lastStatus?.controller?.held)">
              <q-tooltip>Pause</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='arrow_right' v-if="$store.state.tightcnc.lastStatus?.controller?.held" @click="resume">
              <q-tooltip>Resume</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='contact_support' v-if="$store.state.tightcnc.lastStatus?.controller?.held">
              <q-tooltip>Action required</q-tooltip>
            </q-btn> 
            <q-btn outline dense icon='stop' disable v-if="$store.state.tightcnc.lastStatus?.controller?.programRunning">
              <q-tooltip>Stop</q-tooltip>
            </q-btn> 
          </q-btn-group>
            <!--
          <q-btn-group outline>
            <q-btn outline dense label="To Line 5"></q-btn> 
          </q-btn-group>
            -->
          <span>
            State: {{ $store.state.tightcnc.lastStatus?.job?.state}}
            Progress: {{ $store.state.tightcnc.lastStatus?.job?.progress}}
            Stats: {{ $store.state.tightcnc.lastStatus?.job?.stats}}   
          </span>
      </vue-3-gcode-viewer>
    </div>
  </q-page>    
</template>

<script lang="ts">

import Vue3GcodeViewer from 'components/Vue3GcodeViewer.vue'
import { Options, Vue } from 'vue-class-component';
import { uid } from 'quasar'
import { GcodeGoConfig } from '../tightcnc/TightCNCClient';
import * as _ from 'lodash';

export interface WorkBenchSessionData {
    id:string,
    name:string, // Tab Name
    fileName: string,
    fullPath: string,
    gcode?:string,
    tmpFileName?:string
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
     //console.log(this.wdata,this.gcode)
  }

  progress(progress:number){
    if(progress == 0)this.$q.loadingBar.start()
    else if(progress == 100)this.$q.loadingBar.stop()
    else this.$q.loadingBar.increment(progress)
  }

  // Job control
  async startJob(){
    if(!this.wdata.tmpFileName){
      this.wdata.tmpFileName = uid()
      await this.$tightcnc.uploadFile(this.wdata.tmpFileName,this.wdata.gcode as string,true)
    }
    return this.$tightcnc.startJob({
      filename: this.wdata.tmpFileName,    
      gcodeProcessors: this.$tightcnc.getConfig().selectedProcessors?.map( (sel) => {
        const options = this.$tightcnc.getConfig()[sel as keyof GcodeGoConfig];
        return {
          name: sel,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          options: {
              id: _.kebabCase(sel),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...( options as any)
          }
        }
      })
    }).then( (jobstatus)=>{
      this.$store.commit('tightcnc/setJobStatus',jobstatus)
    })
  }

  async resume(){
     await this.$tightcnc.resume()
  }

}
</script>

<style scoped>
h1 {
  float: left;
}

</style>
