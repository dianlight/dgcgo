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
              <q-btn dense outline icon="upgrade" @click="probe()" disable>
                  <q-tooltip>Probe</q-tooltip>
              </q-btn>
              <q-btn dense outline icon="settings_overscan" disable>
                  <q-tooltip>Run on project outline</q-tooltip>
              </q-btn>
            </q-btn-group>
          </div>
        </div>  
      </div>
    </q-card-section>
  </q-card>
</template>

<script lang="ts">
//import { ControllerStatus } from 'app/../tightcnc/types/src';
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

  keyboardEvent?:(e:KeyboardEvent) => void;
  
  /*
  declare $refs:{
      front:QBtn,
      back:QBtn,
      left:QBtn
      right:QBtn
      up:QBtn
      down:QBtn
  }
  */



  mounted(){
   // console.log(this.$store.getters)
         /*
    this.keyboardEvent = (e:KeyboardEvent) => {
        // console.log(this)
         if(!this.$refs.front)return
          switch(e.code){
              case 'ArrowUp':
                  this.simulateClick(this.$refs.front,e)
                break;
              case 'ArrowDown':
                  this.simulateClick(this.$refs.back,e)
                break;
              case 'ArrowLeft':
                  this.simulateClick(this.$refs.left,e)
                break;
              case 'ArrowRight':
                  this.simulateClick(this.$refs.right,e)
                break;
              case 'PageUp':
                  this.simulateClick(this.$refs.up,e)
                break;
              case 'PageDown':
                  this.simulateClick(this.$refs.down,e)
                break;
          }
    }
    document.addEventListener('keydown',this.keyboardEvent)
          */
  }

  unmounted(){
   if(this.keyboardEvent){
     document.removeEventListener('keydown',this.keyboardEvent)
     delete this.keyboardEvent
   }
  }

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

  format(num: number) {
    return num.toFixed(3 /* Precision */);
  }

  home(axes?:boolean[]){
    void this.$tightcnc.home(axes)
  }

  probe() {  
//    void this.$tightcnc.op('send',{line:'M9'}) // StopAll   
//    if(mist) void this.$tightcnc.op('send',{line:'M7'}) // On Mist
//    if(flood) void this.$tightcnc.op('send',{line:'M8'}) // On flood
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
