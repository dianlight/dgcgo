<template>
  <q-card>
    <q-card-section>
      <div class="q-pa-xs">
        <div class="row items-start">
          <div class="q-pa-none  q-gutter-y-xs col items-start">
            <q-btn-group>
              <q-btn-dropdown
               split
               dense 
               outline 
               icon="home" 
               @click="home()">
                <template v-slot:label>
                  <q-tooltip>Home</q-tooltip>
                </template>
                <q-list>
                  <q-item clickable  v-close-popup dense @click="home([true,true])" v-if="$store.getters['tightcnc/capabilities']?.homingSingleAxis">
                    <q-item-section avatar>
                      <q-avatar icon="home"/>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Home X/Y only</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item clickable  v-close-popup dense @click="home([false,false,true])" v-if="$store.getters['tightcnc/capabilities']?.homingSingleAxis">
                    <q-item-section avatar>
                      <q-avatar icon="home"/>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Home Z only</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </q-btn-group>
            <q-btn-group>    
              <q-btn dense outline icon="running_with_errors" @click="clearError()" :disable='$store.state.tightcnc.lastStatus?.controller?.ready'>
                  <q-tooltip>Clear Error</q-tooltip>
              </q-btn>
              <q-btn dense outline icon="restart_alt" @click="reset()">
                  <q-tooltip>Reset</q-tooltip>
              </q-btn>
            </q-btn-group>
            <q-btn-group>    
              <!--q-btn dense outline icon="vertical_align_bottom" @click="probe()">
                  <q-tooltip>Probe Z in current position</q-tooltip>
              </!--q-btn-->
              <q-btn-dropdown
                split
                dense
                outline
                icon="vertical_align_bottom"
                @click="probe({x:$store.state.tightcnc.lastStatus?.controller?.mpos[0],y:$store.state.tightcnc.lastStatus?.controller?.mpos[1]})"
              >
                <template v-slot:label>
                    <q-tooltip>Probe Z in current position {{ format($store.state.tightcnc.lastStatus?.controller?.mpos[0]||0) }} y: {{ format($store.state.tightcnc.lastStatus?.controller?.mpos[1]||0) }}</q-tooltip>
                </template>

                <q-list>
                  
                  <q-item v-for="(pos,index) in $tightcnc.getConfig()?.probe?.bookmarkPositions" :key='index' clickable  dense>
                    <q-item-section avatar @click="probe(pos)" v-close-popup>
                      <q-avatar icon="play_for_work"/>
                    </q-item-section>
                    <q-item-section @click="probe(pos)" v-close-popup>
                      <q-item-label>Probe Z at position</q-item-label>
                      <q-item-label caption>x: {{ format(pos.x) }} y: {{ format(pos.y) }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-icon name="delete" @click="probeRmovePosition(index)"/>
                    </q-item-section>
                  </q-item>

                  <q-separator/>

                  <q-item clickable @click="probeAddPosition" dense>
                    <q-item-section avatar>
                      <q-avatar icon="add_circle_outline"/>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Add current position...</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-separator/>

                  <q-item dense>
                    <q-item-section>
                      <q-input 
                        v-model="zprobe"
                        dense
                        outlined
                        label="Min Z (machine)"
                        type="number"
                        step='0.001'
                        :suffix="$store.state.tightcnc.lastStatus?.controller?.units||''"
                        :clearable="false"
                      />
                    </q-item-section>
                  </q-item>

                  <q-item dense>
                    <q-item-section>
                      <q-input 
                        v-model="probefeed"
                        dense
                        outlined
                        label="Feed"
                        type="number"
                      />
                    </q-item-section>
                  </q-item>

                </q-list>

              </q-btn-dropdown>
              <!--
              <q-btn dense outline icon="settings_overscan" disable>
                  <q-tooltip>Run on project outline</q-tooltip>
              </q-btn>
              -->
            </q-btn-group>
          </div>
        </div>  
      </div>
    </q-card-section>
  </q-card>
</template>

<script lang="ts">
import { QBtn } from 'quasar';
import { Options, Vue } from 'vue-class-component';

@Options({
  components: {},
  watch: {
    zprobe(zprobe:number, oldzprobe:number){
      if(zprobe !== oldzprobe){
          (this as CommandWidget).$tightcnc.updateConfigKey('probe.z',zprobe)
      }
    },
    probefeed(probefeed:number, oldprobefeed:number){
      if(probefeed !== oldprobefeed){
          (this as CommandWidget).$tightcnc.updateConfigKey('probe.feed',probefeed)
      }
    }
//    '$store.state.tightcnc.lastStatus.controller.feed'(feed:number) {
//          (this as ControlWidget).feed = feed;
//    },
//    '$store.state.tightcnc.lastStatus.controller.spindle'(spindle:boolean) {
//          const controller = (this as CommandWidget).$store.state.tightcnc.lastStatus?.controller as ControllerStatus;
//          if(controller)
//            (this as CommandWidget).spindle = !spindle?'OFF':controller.spindleDirection > 0?'CW':'CWW';
//    },
  }  
})
export default class CommandWidget extends Vue {

  private simulateClick(target:QBtn, evt:Event){
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('mousedown'),evt)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('mouseup'),evt)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('click'),evt)
  }

  get lastStatus() {
    return this.$store.state.tightcnc.lastStatus;
  }

  zprobe = 0

  probefeed = 25
  

  format(num: number) {
    return num.toFixed(3 /* Precision */);
  }

  home(axes?:boolean[]){
    void this.$tightcnc.home(axes)
  }

  probe(pos:{x:number,y:number}) {  
    console.log('Probe:',pos)
    const ppos = [
      pos.x,
      pos.y,
      +this.zprobe
    ]
    console.log('Start Probe at Points',ppos)
    void this.$tightcnc.op<number[]>('probe',{
      pos: ppos,
      feed: this.$tightcnc.getConfigKey('probe.feed',this.probefeed)
    }).then( points => { 
      console.log('Probed Points',points) 
      void this.$tightcnc.op('setOrigin',{pos:[false,false,true]}).then( ()=> {
        console.log('Move to Z',this.$tightcnc.getConfigKey('machine.zsafe',10))
        //void this.$tightcnc.move([false,false,this.$tightcnc.getConfigKey('machine.zsafe',10)])
      })
    })
  }

  probeAddPosition(){
    this.$tightcnc.getConfigKey('probe.bookmarkPositions',[] as {x:number,y:number}[]).push({
      x:this.$store.state.tightcnc.lastStatus?.controller?.mpos[0] || 0,
      y:this.$store.state.tightcnc.lastStatus?.controller?.mpos[1] || 0
    })
    this.$tightcnc.storeConfig()
    this.$forceUpdate()
  }

  probeRmovePosition(index:number){
    this.$tightcnc.getConfig().probe?.bookmarkPositions.splice(index,1)
    this.$tightcnc.storeConfig()
    this.$forceUpdate()
  }

  clearError() {
    void this.$tightcnc.op('clearError',{})
  }

  reset(){
    void this.$tightcnc.op('reset',{})
  }

  mounted(){
    this.zprobe = this.$tightcnc.getConfigKey<number>('probe.z',-0.99999)
    this.probefeed = this.$tightcnc.getConfigKey<number>('probe.feed',25)
  //  console.log('Got Config Z',this.zprobe)
  }

  

}
</script>

<style lang="scss" scoped>
.zslider {
    height: 80%;
}

.wtable {
  border: 1px $secondary;
  border-top-style: solid;
  border-left-style: solid;
}
.wtable > div > div {
  border: 1px $secondary;
  border-style: solid;
  border-left-style: none;
  border-top-style: none;
}
</style>