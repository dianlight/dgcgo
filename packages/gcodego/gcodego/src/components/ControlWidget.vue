<template>
  <q-card>
    <q-card-section>
      <div class="q-pa-xs">
        <div class="row">
          <div class="q-pa-none q-gutter-y-none col-8 _column items-start">
            <q-btn-group>
              <q-btn outline icon="north_west" @click="move($event,'front-left')"/>
              <q-btn outline icon="north" v-shortkey="['arrowup']" @shortkey="simulateClickNg" ref="front" @click="move($event,'front')">
                <q-tooltip>Y+</q-tooltip>
              </q-btn>
              <q-btn outline icon="north_east"  @click="move($event,'front-right')"/>
            </q-btn-group>
            <q-btn-group>
              <q-btn outline icon="west" v-shortkey="['arrowleft']" @shortkey="simulateClickNg" ref="left" @click="move($event,'left')">
                <q-tooltip>X-</q-tooltip>
              </q-btn>
              <q-btn outline icon="hide_source" @click="setOrigin([true,true,false])">
                <q-tooltip>Work coordinate X/Y zero.</q-tooltip>
              </q-btn>
              <q-btn outline icon-right="east" v-shortkey="['arrowright']" @shortkey="simulateClickNg" ref="right" @click="move($event,'right')">
                <q-tooltip>X+</q-tooltip>
              </q-btn>
            </q-btn-group>
            <q-btn-group>
              <q-btn outline icon="south_west" @click="move($event,'back-left')"/>
              <q-btn outline icon="south" v-shortkey="['arrowdown']" @shortkey="simulateClickNg" ref="back" @click="move($event,'back')">
                <q-tooltip>Y-</q-tooltip>
              </q-btn>
              <q-btn outline icon="south_east" @click="move($event,'back-right')" />
            </q-btn-group>


            <q-slider dense 
            :label-value="`${incrementxy} ${lastStatus?.controller?.units}`" 
            v-model="incrementxy" :min="0.001" :max="10" :step="0.001" label snap/>

          </div>

          <div class="q-pa-none q-gutter-xy-none col-1 _column _items-start">
            <q-slider dense vertical reverse 
                :label-value="`${incrementz} ${lastStatus?.controller?.units}`" 
                v-model="incrementz" 
                :min="0.001" :max="10" :step="0.001" label snap
                class="zslider" />
          </div> 

          <div class="q-pa-none q-gutter-y-none col _column _items-start">
            <q-btn outline v-shortkey="['pageup']" @shortkey="simulateClickNg" icon="north" ref="up"  @click="move($event,'up')">
              <q-tooltip>Z+</q-tooltip>
            </q-btn>
            <q-btn outline icon="hide_source" @click="setOrigin([false,false,true])">
              <q-tooltip>Work coordinate Z zero.</q-tooltip>
            </q-btn>
            <q-btn outline v-shortkey="['pagedown']" @shortkey="simulateClickNg" icon="south" ref="down"  @click="move($event,'down')">
              <q-tooltip>Z-</q-tooltip>
            </q-btn>
          </div>

        </div>
        <div class="row text-center items-center" v-if="$store.getters['tightcnc/capabilities'] && ($store.getters['tightcnc/capabilities']?.mistCoolant || $store.getters['tightcnc/capabilities']?.floodCoolant)">
            <div class="col text-subtitle1 text-capitalize">
                Coolant
            </div>
            <div class="col-10">
                <q-btn
                    dense
                    size="xs"
                    icon="cancel"
                    rounded
                    color="negative"
                    @click="coolant(false,false)" 
                />
                <q-toggle
                    size="xs"
                    v-model="mist"
                    label="Mist"
                    @click="coolant(mist,flood)"
                    :disable="!$store.getters['tightcnc/capabilities']?.mistCoolant"
                />                
                <q-toggle
                    size="xs"
                    v-model="flood"
                    label="Flood"
                    @click="coolant(mist,flood)"
                    :disable="!$store.getters['tightcnc/capabilities']?.floodCoolant"
                /> 
           </div>
        </div>
        <div class="row text-center items-center">
            <div class="col text-subtitle1 text-capitalize">
                Spindle
            </div>
            <div class="col-5">
                <q-btn-toggle
                v-model="spindle"
                toggle-color="primary"
                dense
                outline
                :options="[
                    {value: 'M3', icon: 'rotate_right', slot: 'cw', disable: spindle_speed == 0},
                    {value: 'M5', icon: 'mode_standby', slot: 'off'},
                    {value: 'M4', icon: 'rotate_left', slot: 'ccw',disable: spindle_speed == 0},
                ]"
                @click="spindleControl"
                >
                    <template v-slot:cw>
                        <q-tooltip>Start Spindle in CW direction</q-tooltip>
                    </template>
                    <template v-slot:off>
                        <q-tooltip>Stop Spindle</q-tooltip>
                    </template>
                    <template v-slot:ccw>
                        <q-tooltip>Start Spindle in CCW direction</q-tooltip>
                    </template>
                </q-btn-toggle>
            </div>    
            <div class="col-4 q-pa-none">    
                <q-knob
                show-value
                font-size="10px"
                v-model="spindle_speed"
                size="60px"
                color="primary"
                :min="$store.state.tightcnc?.lastStatus?.controller?.spindleSpeedMin || 0"
                :max="$store.state.tightcnc?.lastStatus?.controller?.spindleSpeedMax || 8000"
                :step="10"
                track-color="grey-3"
                class="q-ma-md"
                @change="spindleSpeed"
                >
                {{ spindle_speed }} rpm
                </q-knob>
            </div>
        </div>
        <div class="row text-center">
            <div class="col text-subtitle1 text-capitalize">
                Feed
            </div>
            <div class="col-9">
                <q-slider
                    v-model="feed"
                    :label-value="`${feed} ${lastStatus?.controller?.units}/min`" 
                    :min="0"
                    :max="Math.min(...lastStatus?.controller?.axisMaxFeeds||[500])"
                    :step="1"
                    label
                    label-always
                    @change="feedRate"
                    />                
            </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script lang="ts">
import { ControllerStatus } from 'app/../tightcnc/types/src';
import { QBtn } from 'quasar';
import { Options, Vue } from 'vue-class-component';

@Options({
  components: {},
  watch: {
    '$store.state.tightcnc.lastStatus.controller.coolant'(coolant:number) {
          (this as ControlWidget).mist = (coolant == 1 || coolant == 3)?true:false;
          (this as ControlWidget).flood = (coolant == 2 || coolant == 3)?true:false;
    },
//    '$store.state.tightcnc.lastStatus.controller.feed'(feed?:number) {
//          (this as ControlWidget).feed = feed || 0;
//    },
    '$store.state.tightcnc.lastStatus.controller.spindle'(spindle:boolean) {
          const controller = (this as ControlWidget).$store.state.tightcnc.lastStatus?.controller as ControllerStatus;
          if(controller)
            (this as ControlWidget).spindle = !spindle?'M5':controller.spindleDirection > 0?'M3':'M4';
    },
//    '$store.state.tightcnc.lastStatus.controller.spindleSpeed'(speed?:number) {
//          (this as ControlWidget).spindle_speed = speed || 0;
//    },
  }  
})
export default class ControlWidget extends Vue {
    feed = 0
    spindle:'M3'|'M4'|'M5' = 'M5'
    spindle_speed = 0
    incrementz = 0.1
    incrementxy = 0.1
    mist = false
    flood = false

    keyboardEvent?:(e:KeyboardEvent) => void;
  
  declare $refs:{
      front:QBtn,
      back:QBtn,
      left:QBtn
      right:QBtn
      up:QBtn
      down:QBtn
  }



  mounted(){
    //console.log(this.$store.getters)
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
//                  this.simulateClick(this.$refs.up,e)
                break;
              case 'PageDown':
//                  this.simulateClick(this.$refs.down,e)
                break;
          }
    }
    */
    //document.addEventListener('keydown',this.keyboardEvent)
  }

  unmounted(){
   //if(this.keyboardEvent){
   //  document.removeEventListener('keydown',this.keyboardEvent)
   //  delete this.keyboardEvent
   //}
  }

  private simulateClickNg(evt:Event){
      //console.log('---TARGET-->',target)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      evt.currentTarget?.dispatchEvent(new MouseEvent('mousedown'))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      evt.currentTarget?.dispatchEvent(new MouseEvent('mouseup'))
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      evt.currentTarget?.dispatchEvent(new MouseEvent('click'))
  }

/*
  private simulateClick(target:QBtn, evt:Event){
      if(target.$el === evt.currentTarget){
        console.log('Stesso oggetto!')
      } else {
        console.log(target.$el, evt.currentTarget)
      }
      //console.log('---TARGET-->',target)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('mousedown'),evt)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('mouseup'),evt)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      target.$el.dispatchEvent(new MouseEvent('click'),evt)
  }
  */

  get lastStatus() {
    return this.$store.state.tightcnc.lastStatus;
  }

  format(num: number) {
    return num.toFixed(3 /* Precision */);
  }

  move(event:Event,button:string){
      //console.log(button, event.target)
      switch(button){
        case 'front':
            void this.$tightcnc.jogMove(1,this.incrementxy)
            break;
        case 'back':
            void this.$tightcnc.jogMove(1,-this.incrementxy)
            break;
        case 'left':
            void this.$tightcnc.jogMove(0,-this.incrementxy)
            break;
        case 'right':
            void this.$tightcnc.jogMove(0,this.incrementxy)
            break;
        case 'up':
            void this.$tightcnc.jogMove(2,this.incrementz)
            break;
        case 'down':
            void this.$tightcnc.jogMove(2,-this.incrementz)
            break;  
        case 'front-left':
            void this.$tightcnc.jogMove(1,this.incrementxy)
            void this.$tightcnc.jogMove(0,-this.incrementxy)
            break;  
        case 'front-right':
            void this.$tightcnc.jogMove(1,this.incrementxy)
            void this.$tightcnc.jogMove(0,this.incrementxy)
            break;  
        case 'back-left':
            void this.$tightcnc.jogMove(1,-this.incrementxy)
            void this.$tightcnc.jogMove(0,-this.incrementxy)
            break;  
        case 'back-right':               
            void this.$tightcnc.jogMove(1,-this.incrementxy)
            void this.$tightcnc.jogMove(0,this.incrementxy)
            break;  
      }
  }

  private home(axes?:boolean[]){
    void this.$tightcnc.home(axes)
  }

  coolant(mist:boolean, flood:boolean) {  //action:'M7'|'M8'|'M9'){
    void this.$tightcnc.op('send',{line:'M9'}) // StopAll   
    if(mist) void this.$tightcnc.op('send',{line:'M7'}) // On Mist
    if(flood) void this.$tightcnc.op('send',{line:'M8'}) // On flood
  }

  spindleSpeed(){
    console.log('New Speed:',this.spindle_speed)
    if(this.feed == 0){
      this.feed = 1
      this.feedRate()
    }
    void this.$tightcnc.op('send',{line:`G1 S${this.spindle_speed}`,wait:true})  
  }

  spindleControl(){
    console.log('New Spidle:',this.spindle,this.spindle_speed)
  void this.$tightcnc.op('send',{line:`${this.spindle} S${this.spindle_speed}`,wait:true})
  }

  feedRate(){
    console.log('New Feed:',this.feed)
    if(this.feed == 0)this.feed = 1
    void this.$tightcnc.op('send',{line:`G1 F${this.feed}`,wait:true})
  }

  setOrigin(pos:boolean[]){
    void this.$tightcnc.op('setOrigin',{pos:pos})
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
