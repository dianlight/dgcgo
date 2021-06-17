<template>
<q-dialog v-model="show">
  <q-card>
  <h5>TightCNC Preferences</h5>
  <q-form @submit="onSubmit" @reset="onReset" autofocus>
    <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
      <q-input :disable="$q.platform.is.electron" dense v-model="config.host" outlined type="text" label="TightCNC host" />
      <q-input :disable="$q.platform.is.electron" dense v-model="config.serverPort" outlined type="number" label="TightCNC port" />

      <q-input dense v-model="config.authKey" outlined :type="isPwd ? 'password' : 'text'" label="TightCNC AuthKey" _hint="AuthKey">
        <template v-slot:append>
          <q-icon
            :name="isPwd ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>
    </div>
    <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
      <q-select dense outlined emit-value v-model="config.controller" :options="controllers"  label="Controller Type" />

      <template v-if="config.controller === 'grbl'">
        <q-select dense outlined  v-model="portType" :options="['serial','socket','grblsim']" label="Port Type" />

        <template v-if="portType ==='serial'">
          <q-select dense outlined v-model="port" @popup-show="refreshSerialList"  clearable :options="serials" label="Port" emit-value>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <!--
              <q-item-section avatar>
                <q-icon :name="scope.opt.icon" />
              </q-item-section>
              -->
              <q-item-section>
                <q-item-label v-html="scope.opt.label" />
                <q-item-label caption>{{ scope.opt.portInfo.manufacturer }} {{ scope.opt.portInfo.vendorId}} {{ scope.opt.portInfo.productId }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>          
          </q-select>  
          <q-select dense outlined v-model="baudRate" :options="[9600, 14400, 19200, 38400, 57600, 115200, 128000, 256000 ]" label="BaudRate" />
        </template>

        <template v-if="portType ==='socket'">
          <q-input  dense outlined v-model="remoteHost" label="Remote Host" />
          <q-input  dense outlined v-model="remotePort"  type="number" label="Remote Port" />
        </template>

        <template v-if="portType ==='grblsim'">
          <q-input  dense outlined v-model="grblSimPath" label="Path" />
        </template>

      </template>
    </div>
    <q-separator class="q-mt-sm"/>
    <div v-if="config.controller === 'grbl'" class="q-gutter-sm q-mt-sm q-pl-md row items-start">
      <q-field dense outlined label="Available Axes" stack-label>
        <q-checkbox dense v-model="usedAxes[0]" label="X" color="teal" />
        <q-checkbox dense v-model="usedAxes[1]" label="Y" color="orange" />
        <q-checkbox dense v-model="usedAxes[2]" label="Z" color="red" />
      </q-field>

      <q-field dense  outlined label="Homeable Axes" stack-label>
        <q-checkbox dense v-model="homableAxes[0]" label="X" color="teal" />
        <q-checkbox dense v-model="homableAxes[1]" label="Y" color="orange" />
        <q-checkbox dense v-model="homableAxes[2]" label="Z" color="red" />
      </q-field>
    </div>   

    <q-separator class="q-mt-sm"/>

    <div class="q-gutter-md q-mt-sm q-pr-md column items-end">
         <q-btn-group>
            <q-btn label="Reset" type="reset" color="negative"/>
            <q-btn label="Save" type="submit" color="positive" v-close-popup="1"/>
         </q-btn-group> 
    </div>
  </q-form>
  </q-card>
</q-dialog>  
</template>

<script lang="ts">
import { TightCNCConfig, TightCNCControllers,TightCNCGrblConfig, PortInfo } from 'tightcnc'
//import { Client } from '../tightcnc/TightCNC'
import { Options, Vue } from 'vue-class-component';
import URLParse from 'url-parse'


@Options({
  components: {}
})
export default class Preferences extends Vue {

      get show(){
        return this.$store.state.dialogs.preferences
      }
      set show(value:boolean){
        this.$store.commit(`dialogs/${value?'show':'hide'}Dialog`,'preferences');
        this.refreshSerialList()
      }

      portType = 'serial'
      isPwd = true
      config:Partial<TightCNCConfig> = {}
      port = ''
      baudRate = 115200
      usedAxes = [ true, true, true ]
      homableAxes =  [ true, true, true ]
      serials:{label:string,value:string, portInfo:PortInfo}[] = []


      controllers = [
        {label:'none', value:undefined },
        {label:'grbl', value:'grbl'},
        {label:'TinyG *Unsupported*',disable:true}
      ]

      remoteHost=''
      remotePort=23

      grblSimPath=''      

      mounted(){
        this.onReset()
        this.refreshSerialList()  
      }

  

      private refreshSerialList(){
        console.log('-->Serial List!')
        void this.$tightcnc.getAvailableSerials().then( serials => {
          console.log('-->Serial List Return', serials)
          this.serials = serials.map( ss =>  {
            console.log(ss)
            return {
              label:ss.path,
              value:ss.path,
              portInfo: ss}
              })
        })
      }

      onSubmit(){
        
        switch(this.config.controller){
          case 'grbl':
            if(!this.config.controllers)this.config.controllers = {} as TightCNCControllers
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const acontrol = this.config.controllers[this.config.controller] as TightCNCGrblConfig
            switch(this.portType){
              case 'serial':
                acontrol.port = this.port
                break;
              case 'socket':
                acontrol.port = `${this.portType}://${this.remoteHost}:${this.remotePort}`
                break;
              case 'grblsim':
                acontrol.port = `${this.portType}:${this.grblSimPath}`
                break;
            }
          break;
        }
        console.debug('Saving:',this.config)
        this.$tightcnc.updateConfig(this.config,true)
       // void this.$store.dispatch('tightcnc/updateClientConfig', this.config)
      }

      onReset(){
        this.config = JSON.parse(JSON.stringify(this.$tightcnc.config || {})) as Partial<TightCNCConfig>
        if(this.config.controllers && this.config.controller && this.config.controllers[this.config.controller]){
          const acontrol = this.config.controllers[this.config.controller]
          console.log(acontrol)
          const porturl =  new URLParse(acontrol?.port ||'')
          this.portType = porturl.protocol?porturl.protocol.slice(0,-1):'serial'
          console.log('->',this.portType,porturl)
          switch(this.portType){
            case 'http': // Special case for save without protocol
              this.portType = 'serial'
              this.port = porturl.pathname
              break;
            case 'serial':
              console.log(acontrol)
              this.port = acontrol?.port || ''
              break;
            case 'socket':
              //porturl.protocol = 'http:' // Fix to force parser of other parts
              this.remoteHost = porturl.hostname
              this.remotePort = parseInt(porturl.port)
              break;
            case 'grblsim':
              this.grblSimPath = porturl.href.substr(8)
              break;
          }
        }
      }

      

//valueChanged(values:TightCNCConfig) {
//     console.log('Values', values);
//   }
}
</script>

<style lang="scss">
</style>
