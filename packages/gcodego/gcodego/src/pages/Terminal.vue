<template>
<q-page padding ref="page"> 
  <div class="fit row wrap justify-start items-start content-start" _style="`min-height:${viewPortHight()}px; max-height:${viewPortHight()}px`">
      <q-virtual-scroll
        ref="terminal"
        style="height:82vh;width:100%"
        :items="$store.state.tightcnc.logs.lines"
        @virtual-scroll="scrolling"
        >
          <template v-slot="{item}">
            <q-item :key="item.line" dense class='row q-gutter-xs q-pa-none logline'>
              <q-item-section side class="linenumber">
                {{item.line}} <!-- {{index}} -->
              </q-item-section>
              <q-item-section side class="linedirection">
                {{' '+item.direction}}
              </q-item-section>
              <q-item-section class="line">
                  <code :class="item.result?.startsWith('error')?'error':''" v-html="colorGcode(item.data)"></code>
                  <q-item-label v-if="item.result !== undefined" :class="item.result?.startsWith('error')?'error-message':'line'" caption>{{item.result}} {{item.error}}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
      </q-virtual-scroll>  
  </div>
  <div class="row" ref="commandbar">
    <q-input 
    autofocus
    :readonly='sendingCommand'
    class="col12" 
    outlined 
    dense
    v-model="command" 
    style="width: 100%;" 
    label="#> [Enter => send] [Shift+Enter => send directly]" 
    @keyup="sendCommand" 
    >
      <template v-slot:append>
          <q-icon v-if="command !== ''" name="close" @click="command = ''" class="cursor-pointer" />
        </template>
      <template v-slot:after>
        <q-btn round dense flat icon="send" :loading="sendingCommand" :disable="!command" @click="sendCommand">
          <q-tooltip>Send command. [Shift => send in direct mode]</q-tooltip>
          <template v-slot:loading>
              <q-spinner-gears />
          </template>
        </q-btn> 
      </template>

    </q-input>
  </div>
  <div class="row" ref="toggles">
    <!--
    <q-btn
        outline
        dense
        label="Autoscroll"
        @click="autoScroll"
    />
    -->
    <q-toggle
        size="xs"
        v-model="autoScroll"
        label="Autoscroll"
    />
    <q-toggle
        size="xs"
        v-model="filterStatus"
        label="Filter Status messages"
    />
    <q-toggle
        size="xs"
        v-model="filterControl"
        label="Filter Control messaged"
    />
    <q-toggle
        size="xs"
        v-model="matchStatus"
        label="Inline response"
    />
    <!--
    {{ $store.state.tightcnc.logs.options }}
    {{ $store.state.tightcnc.logs.lastVisualizedLine }}
    -->
  </div>
</q-page>  
</template>

<script lang="ts">
import { Vue, Options } from 'vue-class-component'
import hljs from 'highlight.js/lib/core';
import gcode from 'highlight.js/lib/languages/gcode';
import { QPage, QVirtualScroll } from 'quasar';
import { dom } from 'quasar'
import * as _ from 'lodash';
import { GcodeGoConfig } from '@dianlight/gcodego-core';

hljs.registerLanguage('gcode',gcode);



@Options({
  components: {},
  /*
  watch: {
    '$store.state.tightcnc.logs.lines'(lines:LogLine[]) {
      if( (this as Terminal).$store.state.tightcnc.logs.options.autoScroll){
        console.log('Autoscroll to:',lines.length);
        (this as Terminal).$refs.terminal.scrollTo(lines.length)
      }
    }
  }
  */
})
export default class Terminal extends Vue {


  get filterStatus(){
    return this.$store.state.tightcnc.logs.options.filterStatus
  }
  set filterStatus(value:boolean){
    this.$store.commit('tightcnc/setLogOptions',{
      filterStatus:value
    })
  }

  get filterControl(){
    return this.$store.state.tightcnc.logs.options.filterControl
  }
  set filterControl(value:boolean){
    this.$store.commit('tightcnc/setLogOptions',{
      filterControl:value
    })
  }
  get matchStatus(){
    return this.$store.state.tightcnc.logs.options.matchStatus
  }
  set matchStatus(value:boolean){
    this.$store.commit('tightcnc/setLogOptions',{
      matchStatus: value
    })
  }

  get autoScroll(){
    return this.$store.state.tightcnc.logs.options.autoScroll
  }
  set autoScroll(value:boolean){
    this.$store.commit('tightcnc/setLogOptions',{
      autoScroll: value
    })
    if(value)this.$refs.terminal.scrollTo(this.$store.state.tightcnc.logs.lines.length-1)
    else this.$refs.terminal.scrollTo(this.$store.state.tightcnc.logs.lines.length-2)
  }

  command = ''
  sendingCommand = false
  
  declare $refs: {
    terminal:QVirtualScroll,
    page: QPage,
    commandbar: HTMLDivElement,
    toggles: HTMLDivElement
  }


  colorGcode(l:string) {
      // Highligt GCODE
      return hljs.highlight(l, { language: 'gcode' }).value;
  }

  override mounted(){
    console.log('Scroll to:',this.$store.state.tightcnc.logs.lastVisualizedLine)
    this.$refs.terminal.scrollTo(this.$store.state.tightcnc.logs.lastVisualizedLine,'start')
//    this.logs=[]
//    this.$refs.terminal.reset()
//    setTimeout(this.readLog,1000,this)
   // void this.$nextTick(()=>{
   //   this.autoScroll()
   //   }
   // )
  }

  viewPortHight():number{
    if(!this.$refs.page)return 500
    return dom.height(this.$refs.page.$el)
    -dom.height(this.$refs.commandbar)
    -dom.height(this.$refs.toggles)

  }
  
  scrolling(detail:{index:number,from:number,to:number,direction:'increase'|'decreise'}){
    //console.log('Ricevuto evento scroll:',detail)
    this.$store.commit('tightcnc/setLogLastVisualizedLine',detail.index) 
    if(this.autoScroll && detail.direction==='increase'){
      this.$refs.terminal.scrollTo(this.$store.state.tightcnc.logs.lines.length-1)
    } else {
      this.$store.commit('tightcnc/setLogOptions',{
        autoScroll: detail.index === detail.to
      })    
    }
  }

 sendCommand(event: KeyboardEvent|MouseEvent){
    if(event instanceof KeyboardEvent && event.key && event.key !== 'Enter')return
    this.sendingCommand = true
    if(event.shiftKey){
      void this.$tightcnc.send({line:this.command, wait: false}).then( ()=> {
        this.sendingCommand = false
        this.command = ''
      })    
    } else {
      void this.$tightcnc.send({
        line:this.command, 
        wait: false, 
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
        }),
      }).then( ()=> {
        this.sendingCommand = false
        this.command = ''
      })    
    }
 
  }

}
</script>

<style lang="scss" scoped>
  @import url('highlight.js/styles/github.css');

label {
  width: 100%;
}

.linenumber {
  font-size: x-small;
  color: $secondary;
  background-color: $dark;
  padding-right: 0px;
}

.linedirection {
  font-size: x-small;
  color: $primary;
  background-color: $dark;
  padding-right: 0px;
  margin-left: 0px;
}

.line {
  font-size: x-small;
}

.logline {
  min-height: 10px
}

.logline:hover {
  background-color: aqua;
}

.error {
  background-color: $red-2;
}

.error-message {
  color: $negative;
  font-size: x-small;
}

</style>
