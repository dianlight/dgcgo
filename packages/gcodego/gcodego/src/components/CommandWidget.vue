<template>
  <q-card>
    <q-card-section>
      <div class="q-pa-xs">
        <div class="row items-start">
          <div class="q-pa-none  q-gutter-y-xs col items-start">
            <q-btn-group>
              <q-btn dense outline icon="home" @click="home()">
                  <q-tooltip>Home</q-tooltip>
              </q-btn>
              <q-btn dense outline icon="home" @click="home([true,true])" v-if="$store.getters['tightcnc/capabilities']?.homingSingleAxis">
                  X/Y
                  <q-tooltip>Home X/Y</q-tooltip>
              </q-btn>
              <q-btn dense outline icon="home" @click="home([false,false,true])" v-if="$store.getters['tightcnc/capabilities']?.homingSingleAxis">
                  Z
                  <q-tooltip>Home Z</q-tooltip>
              </q-btn>
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
                @click="probe"
              >
                <template v-slot:label>
                    <q-tooltip>Probe Z in current position</q-tooltip>
                </template>
                <q-list>
                  
                  <q-item v-for="(pos,index) in $tightcnc.getConfig()?.probe?.bookmarkPositions" :key='index' clickable v-close-popup dense>
                    <q-item-section avatar @click="probe(pos)">
                      <q-avatar icon="play_for_work"/>
                    </q-item-section>
                    <q-item-section @click="probe(pos)">
                      <q-item-label>Probe Z at position</q-item-label>
                      <q-item-label caption>x: {{ format(pos.x) }} y: {{ format(pos.y) }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-icon name="delete" @click="probeRmovePosition(index)"/>
                    </q-item-section>
                  </q-item>

                  <q-item clickable v-close-popup @click="probeAddPosition" dense>
                    <q-item-section avatar>
                      <q-avatar icon="add_circle_outline"/>
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>Add current position...</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item dense>
                    <q-item-section>
                      <q-input 
                        v-model="zprobe"
                        dense
                        outlined
                        label="Min Z"
                        type="number"
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

  get zprobe(){
    return this.$tightcnc.getConfigKey('probe.z',-0.1)
  }
  set zprobe(z){
    this.$tightcnc.updateConfigKey('probe.z',z)
  }

  get probefeed(){
    return this.$tightcnc.getConfigKey('probe.feed',25)
  }
  set probefeed(f){
    this.$tightcnc.updateConfigKey('probe.feed',f)
  }
  

  format(num: number) {
    return num.toFixed(3 /* Precision */);
  }

  home(axes?:boolean[]){
    void this.$tightcnc.home(axes)
  }

  probe(pos?:{x:number,y:number}) {  
    console.log('Probe:',pos)
    const ppos = [
      pos?.x || this.$store.state.tightcnc.lastStatus?.controller?.pos[0] || 0,
      pos?.y || this.$store.state.tightcnc.lastStatus?.controller?.pos[1] || 0,
      this.zprobe
    ]
    void this.$tightcnc.op<number[]>('probe',{
      pos: ppos,
      feed: this.$tightcnc.getConfigKey('probe.feed',this.$store.state.tightcnc.lastStatus?.controller?.axisMaxFeeds[3] || 25)
    }).then( points => console.log('Probed Points',points))
  }

  probeAddPosition(){
    this.$tightcnc.getConfig().probe?.bookmarkPositions.push({
      x:this.$store.state.tightcnc.lastStatus?.controller?.pos[0] || 0,
      y:this.$store.state.tightcnc.lastStatus?.controller?.pos[1] || 0
    })
    this.$tightcnc.saveConfig()
  }

  probeRmovePosition(index:number){
    this.$tightcnc.getConfig().probe?.bookmarkPositions.splice(index,1)
    this.$tightcnc.saveConfig()
  }

  clearError() {
    void this.$tightcnc.op('clearError',{})
  }

  reset(){
    void this.$tightcnc.op('reset',{})
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
