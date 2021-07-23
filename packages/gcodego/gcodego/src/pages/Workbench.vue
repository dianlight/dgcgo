<template>
  <q-page padding ref="page"> 
    <div class="row wrap justify-start items-start content-start" style="height:92vh;" _style="`min-height:${viewPortHight()}px; max-height:${viewPortHight()}px`">
      <Q3DViewer
        :gcode="gcode"
        :gcgrid="false"
        :dark-mode="$q.dark.isActive"
        :current-line="$store.state.tightcnc.lastStatus?.job?.stats?.lineCount"
        :cursor-position="$store.state.tightcnc.lastStatus?.controller?.mpos"
        :machine-surface="$store.state.tightcnc.lastStatus?.controller?.axisMaxTravel"
        :machine-offset="$store.state.tightcnc.lastStatus?.controller?.mposOffset"
        :home-direction="$store.state.tightcnc.lastStatus?.controller?.homeDirection"
        @onprogress='progress'
      >
          <q-btn-group v-if="gcode" outline>
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
          <span v-if="gcode">
            State: {{ $store.state.tightcnc.lastStatus?.job?.state}}
            Progress: {{ $store.state.tightcnc.lastStatus?.job?.progress}}
            Stats: {{ $store.state.tightcnc.lastStatus?.job?.stats}}   
          </span>
      </Q3DViewer>
    </div>
  </q-page>    
</template>

<script lang="ts">

import Q3DViewer from '@dianlight/q-3d-viewer'
import { Options, Vue } from 'vue-class-component';
//import { Watch } from 'vue-property-decorator'
import { uid } from 'quasar'
import { GcodeGoConfig } from '@dianlight/gcodego-core';
import * as _ from 'lodash';
import { WorkBenchSessionData } from './WorkBenchSessionData'



@Options({
  components: { Q3DViewer },
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
export default class WorkBench extends Vue {

  id=''

  wdata:Partial<WorkBenchSessionData> = {}

  gcode = ''

  override created(){
    console.log(this.$options.components)
  }

  override mounted(): void {
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
