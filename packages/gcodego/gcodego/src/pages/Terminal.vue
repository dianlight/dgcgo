<template>
<q-page padding ref="page"> 
  <div class="fit row wrap justify-start items-start content-start" _style="`min-height:${viewPortHight()}px; max-height:${viewPortHight()}px`">
      <q-virtual-scroll
        ref="terminal"
        style="height:70vh;width:100%"
        :items="logs"
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
                  <code :class="item.result?.startsWith('error')?'error':''" v-html="item.data"></code>
                  <q-item-label v-if="item.result !== undefined" :class="item.result?.startsWith('error')?'error-message':''" caption>{{item.result}} {{item.error}}</q-item-label>
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
    <q-toggle
        size="sx"
        v-model="matchStatus"
        label="Inline response (*alpha)"
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

interface LogLine {
    line: number,
    direction: '<'|'>'|'@'|'%',
    data: string,
    result?:string
    error?:string
  }

@Options({
  components: {},
})
export default class Terminal extends Vue {

  readonly LIMIT = 1000

  filterStatus = true
  matchStatus = true

  command = ''
  sendingCommand = false
  start = -this.LIMIT
  logs:LogLine[] = []

  declare $refs: {
    terminal:QVirtualScroll,
    page: QPage,
    commandbar: HTMLDivElement,
    toggles: HTMLDivElement
  }

  
  readLog = (self:Terminal)=>{
    if(!self.$refs.terminal)return // Terminal not visible!
    void self.$tightcnc.op<[number,string][]>('getLog',{logType:'comms',start:self.start,limit:self.LIMIT}).then( 
       (lines)=>{
 //        console.log('>Before:',self.logs)
         console.log('Ricevute:',lines.length,lines)
         self.logs.push(...lines
           .filter( l => l[0] > self.start)
           .map( l => { 
              // Basic Log Mapping 
              self.start= l[0]
              return {
                line:l[0],
                direction: l[1].substr(0,1) as '<'|'>',
                data: l[1].substr(2)
              } as LogLine
            })
          .filter( self.markStatusGcode() )
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .reduce<LogLine[]>( (previousValue: LogLine[], currentValue: LogLine, currentIndex: number, all: LogLine[])=>{
              if(self.matchStatus && currentValue.direction === '<' && (currentValue.data==='ok' || currentValue.data.startsWith('error:'))){
              //  console.log('Response!',currentValue,currentIndex)
                let match = false;
                  // Search in previus 100 lines
                for( let value of self.logs.slice(self.logs.length-100).filter( dv=>dv.direction === '>')){
                  if(!value.result){
                   // console.log('Setting on line:',value,currentValue.data)
                    value.result = currentValue.data 
                    match=true
                    break
                  }
                }
                if(!match){
                  for(let value of previousValue.filter( dv=>dv.direction === '>')){
                    if(!value.result){
                    //  console.log('Setting on line:',value,currentValue.data)
                      value.result = currentValue.data 
                      match=true
                      break
                    }
                  }
                  if(!match){
                    previousValue.push(currentValue)
                  }
                }
              } else if(self.matchStatus && currentValue.direction == '@'){
                let match=false
                // Search in previus 100 lines
                for( let value of self.logs.slice(self.logs.length-100).filter( dv=>dv.direction === '>')){
                  if(value.result?.startsWith('error:')){
                    value.error = currentValue.data 
                    match=true
                    break
                  }
                }
                if(!match){
                  for(let value of previousValue.filter( dv=>dv.direction === '>')){
                    if(value.result?.startsWith('error:')){
                      value.error = currentValue.data 
                      match=true
                      break
                    }
                  }
                  if(!match){
                    previousValue.push(currentValue)
                  }
                }
              } else {
                previousValue.push(currentValue)
              }
              return previousValue;
          },[] as LogLine[]) 
          .filter( self.filterStatusGcode())
          .map( self.colorGcode())
         );

//         console.log('After:',self.logs)

//         self.$refs.terminal.refresh(self.autoScroll?self.logs.length-1:undefined)
         if(lines.length > 0 && self.$refs.terminal)self.$refs.terminal.refresh()
         if(lines.length < self.LIMIT){
           setTimeout(self.readLog,1000,self);
         } else {
           self.readLog(self)
         }
       } )
  }

  private colorGcode(): (value: LogLine, index: number, array: LogLine[]) => LogLine {
    return l => {
      // Highligt GCODE
      l.data=hljs.highlight(l.data, { language: 'gcode' }).value;
      return l;
    };
  }

  private markStatusGcode(): (value: LogLine, index: number, array: LogLine[]) => LogLine {
    return (log) => {
      if(log.direction==='>') {
        if(log.data==='?'){
          log.direction='%'
        }
      } else {
        if(log.data.startsWith('<'))
          log.direction='%'
      }
      return log;
    };
  }

  private filterStatusGcode(): (value: LogLine, index: number, array: LogLine[]) => unknown {
    return (log) => {
      if(this.filterStatus){
        return !(log.direction === '%' || log.data.indexOf('(sync)') > 0)
      }
      else return true;
    };
  }

  mounted(){
    this.logs=[]
    this.$refs.terminal.reset()
    setTimeout(this.readLog,1000,this)
   // void this.$nextTick(()=>{
   //   this.autoScroll()
   //   }
   // )
  }

  unmounted(){
    console.log('unount');
    this.logs=[]
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
//  handleScroll(...args:any[]){
//    console.log('Scroll',args)
//    this.autoScroll = false;
//    if(pixel < this.logs.length)this.autoScroll=false
//  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
//  handleStartReached(pixel:number){
//    console.log('Start scroll',pixel)
//  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
//  handleEndReached(pixel:number){
//    console.log('Stop scroll',pixel)
//    this.autoScroll = true;
//  }

  sendCommand(event: KeyboardEvent){
    if(event.key && event.key !== 'Enter')return
    this.sendingCommand = true
    void this.$tightcnc.op('send',{line:this.command, wait: false}).then( ()=> {
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

.error {
  background-color: $red-2;
}

.error-message {
  color: $negative;
}

</style>
