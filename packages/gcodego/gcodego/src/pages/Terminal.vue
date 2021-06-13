<template>
<q-page padding ref="page"> 
  <div class="fit row wrap justify-start items-start content-start">
      <q-virtual-scroll
        ref="terminal"
        style="max-height: 300px;width:100%"
        :items="logs"
        @scroll="handleScroll"
        >
          <template v-slot="{item}">
            <q-item :key="item.line" dense class='row q-gutter-xs q-pa-none'>
              <q-item-section side class="linenumber">
                {{item.line}}
              </q-item-section>
              <q-item-section side class="linedirection">
                {{' '+item.direction}}
              </q-item-section>
              <q-item-section>
                  <code v-html="item.data"></code>
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
    style="width: 100$;" 
    label="#>" 
    @keyup="sendCommand" 
    >
      <template v-slot:append>
          <q-icon v-if="command !== ''" name="close" @click="command = ''" class="cursor-pointer" />
        </template>
      <template v-slot:after>
        <q-btn round dense flat icon="send" :loading="sendingCommand" :disable="!command" @click="sendCommand">
          <template v-slot:loading>
              <q-spinner-gears />
          </template>
        </q-btn> 
      </template>

    </q-input>
  </div>
  <div class="row" ref="toggles">
    <q-btn
        outline
        dense
        label="Autoscroll"
        @click="autoScroll"
    />
    <q-toggle
        size="sx"
        v-model="filterStatus"
        label="Filter Status Lines"
    />
  </div>
</q-page>  
</template>

<script lang="ts">
import { Vue, Options } from 'vue-class-component'
import hljs from 'highlight.js/lib/core';
import gcode from 'highlight.js/lib/languages/gcode';
import { QPage, QVirtualScroll } from 'quasar';
import { dom } from 'quasar'

hljs.registerLanguage('gcode',gcode);

@Options({
  components: {},
})
export default class Terminal extends Vue {

  filterStatus = true

  command = ''
  sendingCommand = false
  start = 0
  logs:{
    line: number,
    direction: '<'|'>',
    data: string
  }[] = []

  declare $refs: {
    terminal:QVirtualScroll,
    page: QPage,
    commandbar: HTMLDivElement,
    toggles: HTMLDivElement
  }
  
  readLog = (self:Terminal)=>{
    void self.$tightcnc.op<[number,string][]>('getLog',{logType:'comms',start:this.start,limit:100}).then( 
       (lines)=>{
         self.start+=lines.length
         self.logs.push(...lines
           .map( l => { 
            return {
              line:l[0],
              direction: l[1].substr(0,1) as '<'|'>',
              data: l[1].substr(2)
            }
          }).filter( (log)=>{
            if(!self.filterStatus)return true
            if(log.direction === '>'){
              if(log.data === '?') return false
            } else {
              if(log.data.startsWith('<'))return false
            }
            return true
          }).map( l => {
            l.data = hljs.highlight(l.data ,{language: 'gcode'}).value
            return l
          })
         );
//         self.$refs.terminal.refresh(self.autoScroll?self.logs.length-1:undefined)
         self.$refs.terminal.refresh()
         if(lines.length < 100){
           setTimeout(this.readLog,1000,self);
         } else {
           this.readLog(self)
         }
       } )
  }

  mounted(){
    setTimeout(this.readLog,1000,this)
    void this.$nextTick(()=>{
      this.autoScroll()
      }
    )
  }

  viewPortHight():number{
    if(!this.$refs.page)return 500
    return dom.height(this.$refs.page.$el)
    -dom.height(this.$refs.commandbar)
    -dom.height(this.$refs.toggles)

  }

  autoScroll(){
    this.$refs.terminal.refresh(this.logs.length-1)
  }
  

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleScroll(...args:any[]){
//    console.log('Scroll',args)
//    this.autoScroll = false;
//    if(pixel < this.logs.length)this.autoScroll=false
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleStartReached(pixel:number){
//    console.log('Start scroll',pixel)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleEndReached(pixel:number){
//    console.log('Stop scroll',pixel)
//    this.autoScroll = true;
  }

  sendCommand(event: KeyboardEvent){
    if(event.key && event.key !== 'Enter')return
    this.sendingCommand = true
    void this.$tightcnc.op('send',{line:this.command, wait: true}).then( ()=> {
      this.sendingCommand = false
      this.command = ''
      this.autoScroll()
    })
  }

}
</script>

<style lang="scss" scoped>
  @import url('highlight.js/styles/github.css');

label {
  width: 100%;
}

.linenumber {
  font-size: smaller;
  color: $secondary;
  background-color: $dark;
  padding-right: 0px;
}

.linedirection {
  font-size: smaller;
  color: $primary;
  background-color: $dark;
  padding-right: 0px;
  margin-left: 0px;
}

</style>
