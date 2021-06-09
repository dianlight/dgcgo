<template>
  <q-card>
    <q-card-section>
      <div class="q-pa-none">
        <div class="row">

          <div class="q-pa-none q-gutter-y-none col-8 _column items-start">
            <q-btn-group>
              <q-btn outline icon="north_west" @click="move"/>
              <q-btn outline icon="north" ref="front" @click="move($event,'front')">
                <q-tooltip>Y+</q-tooltip>
              </q-btn>
              <q-btn outline icon="north_east" />
            </q-btn-group>
            <q-btn-group>
              <q-btn outline icon="west" ref="left" @click="move($event,'left')">
                <q-tooltip>X-</q-tooltip>
              </q-btn>
              <q-btn outline icon="home">
                <q-tooltip>Home X/Y</q-tooltip>
              </q-btn>
              <q-btn outline icon-right="east" ref="right" @click="move($event,'right')">
                <q-tooltip>X+</q-tooltip>
              </q-btn>
            </q-btn-group>
            <q-btn-group>
              <q-btn outline icon="south_west" />
              <q-btn outline icon="south" ref="back" @click="move($event,'back')">
                <q-tooltip>Y-</q-tooltip>
              </q-btn>
              <q-btn outline icon="south_east" />
            </q-btn-group>


            <q-slider dense 
            :label-value="incrementxy + lastStatus?.controller.units" 
            v-model="incrementxy" :min="0.001" :max="10" :step="0.001" label snap/>

          </div>

          <div class="q-pa-none q-gutter-xy-none col-1 _column _items-start">
            <q-slider dense vertical reverse 
                :label-value="incrementz + lastStatus?.controller.units" 
                v-model="incrementz" 
                :min="0.001" :max="10" :step="0.001" label snap
                class="zslider" />
          </div> 

          <div class="q-pa-none q-gutter-y-none col _column _items-start">
            <q-btn outline icon="north" ref="up" @click="move($event,'up')">
              <q-tooltip>Z+</q-tooltip>
            </q-btn>
            <q-btn outline icon="home">
              <q-tooltip>Home Z</q-tooltip>
            </q-btn>
            <q-btn outline icon="south" ref="down" @click="move($event,'down')">
              <q-tooltip>Z-</q-tooltip>
            </q-btn>
          </div>

        </div>
        <div class="row text-center items-center">
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
                />
                <q-toggle
                    size="xs"
                    v-model="mist"
                    label="Mist"
                />                
                <q-toggle
                    size="xs"
                    v-model="flood"
                    label="Flood"
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
                    {value: 'CW', icon: 'rotate_right', slot: 'cw'},
                    {value: 'OFF', icon: 'mode_standby', slot: 'off'},
                    {value: 'CCW', icon: 'rotate_left', slot: 'ccw'},
                ]"
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
                :min="0"
                :max="10000"
                :step="100"
                track-color="grey-3"
                class="q-ma-md"
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
                    :min="0"
                    :max="100"
                    :step="1"
                    label
                    label-always
                    />                
            </div>
        </div>
      </div>

      <!--  
        <div class='q-pa-none wtable'>
            <div class="row text-center ">
                <div class="col text-caption">
                    Axis
                </div>
                <div class="col-5 text-caption">
                    Machine Position
                </div>
                <div class="col-5 text-caption">
                    Work Position
                </div>
            </div>
            <!- - eslint-disable-next-line vue/require-v-for-key - ->
            <div class="row text-center" v-for="(axe, index) in lastStatus?.controller.axisLabels">
                <div class="col text-h5 text-uppercase">
                    {{ axe }}
                </div>
                <div class="col-5 text-h6">
                  {{format(lastStatus?.controller.mpos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller.units}}</p>
                </div>
                <div class="col-5 text-h6">
                   {{format(lastStatus?.controller.pos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller.units}}</p>
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Feed
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.feed}}
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Coolant
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.coolant}}
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Spindle
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.spindle}}
                </div>
            </div>
        </div>
        -->
    </q-card-section>
    <!--       {{ lastStatus }}-->
  </q-card>
</template>

<script lang="ts">
import { QBtn } from 'quasar';
import { Options, Vue } from 'vue-class-component';

@Options({
  components: {},
})
export default class ControlWidget extends Vue {
    feed = 0
    spindle = 'OFF'
    spindle_speed = 0
    incrementz = 0.1
    incrementxy = 0.1
    mist = false
    flood = false
  
  declare $refs:{
      front:QBtn,
      back:QBtn,
      left:QBtn
      right:QBtn
      up:QBtn
      down:QBtn
  }


  private keyboardEvent(e:KeyboardEvent):void{
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

  mounted(){
     document.addEventListener('keydown',this.keyboardEvent)
  }

  unmounted(){
      document.removeEventListener('keydown',this.keyboardEvent)
  }

  private simulateClick(target:QBtn, evt:Event){
      console.log('---TARGET-->',target)
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

  move(event:Event,button:string){
      console.log(button, event.target)
      switch(button){
        case 'front':
            this.$store.state.tightcnc?.client?.jogMove(1,this.incrementxy)
            break;
        case 'back':
            this.$store.state.tightcnc?.client?.jogMove(1,-this.incrementxy)
            break;
        case 'left':
            this.$store.state.tightcnc?.client?.jogMove(0,-this.incrementxy)
            break;
        case 'right':
            this.$store.state.tightcnc?.client?.jogMove(0,this.incrementxy)
            break;
        case 'up':
            this.$store.state.tightcnc?.client?.jogMove(2,this.incrementz)
            break;
        case 'down':
            this.$store.state.tightcnc?.client?.jogMove(2,-this.incrementz)
            break;         
      }
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
