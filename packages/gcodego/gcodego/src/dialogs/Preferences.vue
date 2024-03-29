<template>
<q-dialog v-model="show" full-width full-height>
  <q-card class="column full-height">
        <q-card-section>
          <div class="text-h6">{{$t('menu.preferences')}}</div>
        </q-card-section>

         <q-card-section class="col q-pt-none">
  <q-form @submit="onSubmit" @reset="onReset" autofocus>
    <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
      <q-input :disable="$q.platform.is.electron" dense v-model="config.host" outlined type="text" label="TightCNC host" />
      <q-input :disable="$q.platform.is.electron" dense v-model="config.serverPort" outlined type="number" label="TightCNC port" />

      <q-input dense v-model="config.authKey" outlined :type="isPwd ? 'password' : 'text'" label="TightCNC AuthKey" hint="AuthKey">
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
          <q-select 
          dense 
          outlined 
          v-model="port" 
          @popup-show="refreshSerialList"  
          @new-value="createNewSerial"
          use-input
          clearable 
          :options="serials" 
          label="Port" 
          emit-value>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
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

    <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
      <q-input v-if="config.machine"
       v-model="config.machine.zsafe"
       type="number"
       label="Z safe position (wcord)"
       />
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

     <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
    <q-select
          filled
          v-model="config.selectedPlugins"
          multiple
          :options="$plugins.listPluginRegister()"
          use-chips
          stack-label
          label="Active Plugins"
          @add='addUIPlugin'
          @remove='removeUIPlugin'
          style="min-width: 100vh"
    /> 
     </div>

    <q-separator class="q-mt-sm"/>

     <div class="q-gutter-md q-mt-sm q-pl-md row items-start">
      <q-select
            filled
            v-model="selectedRequiredProcessors"
            multiple
            :options="[] /*availableProgessorsFiltered(true)*/"
            options-dense  
            use-chips
            stack-label
            label="Active GCode Processors (required)"
            readonly
            style="min-width: 50vh"
      >
      </q-select>

      <q-select
            filled
            v-model="config.selectedProcessors"
            multiple
            :options="availableProgessorsFiltered(false)"
            options-dense  
            use-chips
            stack-label
            label="Active GCode Processors (all active)"
            @remove="removeProcessor"
            style="min-width: 50vh"
      >
      </q-select>
     </div>

    <template v-for="prc in config.selectedProcessors || []" :key="prc">
          <q-separator class="q-mt-sm"/>
          <json-forms v-if="availableProcessors[prc] !== undefined"
            :data="processorConfig(prc)"
            :renderers="renderers"
            :schema="availableProcessors[prc].schema" 
            :uischema="{
              type: 'Group',
              label: capitalize(prc),
              elements: [availableProcessors[prc].uiSchema]
              }"
            @change="onChange(prc,$event)"
          />           
    </template>
   
  </q-form>
         </q-card-section>

        <q-card-actions align="right">
          <q-btn label="Cancel" color="primary" v-close-popup="1"/>
          <q-btn label="Reset" @click="onReset" color="negative"/>
          <q-btn label="Save" @click="onSubmit" color="positive" v-close-popup="1"/>
        </q-card-actions>

  </q-card>         

</q-dialog>  
</template>

<script lang="ts">
import { TightCNCConfig, TightCNCControllers, PortInfo } from '@dianlight/tightcnc-core'
import { GcodeProcessorLifeCycle } from '@dianlight/tightcnc-core'
import { Options, Vue } from 'vue-class-component';
import { markRaw } from 'vue'
import URLParse from 'url-parse'
import { GcodeGoConfig } from '@dianlight/gcodego-core';
import { JSONSchema7 } from 'json-schema';
import { JsonForms, JsonFormsChangeEvent } from '@jsonforms/vue';
import {
//  defaultStyles,
//  mergeStyles,
  vanillaRenderers,
} from '@jsonforms/vue-vanilla';
import { UISchemaElement } from '@jsonforms/core';
import { format } from 'quasar'
import * as _ from 'lodash';



@Options({
  components: { JsonForms },
  watch:{
    '$store.state.dialogs.preferences'(newValue:boolean,oldValue:boolean){
       const self = (this as Preferences) 
       //console.log('@@@@@@@@@@@@@@@@@@',oldValue,newValue,self.availableProcessors);
       if(oldValue !== newValue && newValue == true){
        self.config = self.$tightcnc.getConfig(); 
        self.refreshSerialList();
        self.refreshGcodeProcessorsList();
        void self.$nextTick( ()=>  self.onReset())
       }
    }
  }
})
export default class Preferences extends Vue {
      get show(){
        return this.$store.state.dialogs.preferences
      }
      set show(value:boolean){
        this.$store.commit(`dialogs/${value?'show':'hide'}Dialog`,'preferences');
      }
      

      portType = 'serial'
      isPwd = true
      config:Partial<GcodeGoConfig> = {}
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

      availableProcessors:Record<string,{
        schema: JSONSchema7,
        uiSchema: UISchemaElement|void,
        lifeCycle: GcodeProcessorLifeCycle
      }> = markRaw({})

      selectedRequiredProcessors:string[] = [] 

      // Json Form
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      renderers = Object.freeze(markRaw([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...vanillaRenderers,
        // here you can add custom renderers
      ]));


/*
      mounted(){
        console.log('Mounted!')
        this.onReset()
        this.refreshSerialList()  
        this.refreshGcodeProcessorsList()
      }
      */
  

      private refreshSerialList(){
        void this.$tightcnc.getAvailableSerials().then( serials => {
          this.serials = serials.map( ss =>  {
            return {
              label:ss.path,
              value:ss.path,
              portInfo: ss
              }
            })
        })
      }

      private createNewSerial(serial:string,done:(val:string)=>void){
        done(serial)
      }

      private refreshGcodeProcessorsList(){
        void this.$tightcnc.op<Record<string,{
        schema: JSONSchema7,
        uiSchema: UISchemaElement|void,
        lifeCycle: GcodeProcessorLifeCycle
        }>>('getAvailableGcodeProcessors').then( (list)=>{
          this.availableProcessors =  list
        })
      }

      private capitalize(str:string){
        return format.capitalize(str)
      }

    

      private processorConfig(prc:string){
        return this.config[prc as keyof GcodeGoConfig] || {}
      }

      private availableProgessorsFiltered(required:boolean) {
        console.log('Processors:',required,this.availableProcessors)
        const allProcessors = Object.keys(this.availableProcessors)
        const freeProcessors = allProcessors.filter( pl => ['server-only' as GcodeProcessorLifeCycle,'optional-ui' as GcodeProcessorLifeCycle].includes(this.availableProcessors[pl].lifeCycle))        
        const requiredProcessors = this.config.selectedPlugins?.reduce( (res:string[],cur:string)=>{
              res.push( ...this.$plugins._pluginRegister[cur].dependencies().tightcncProcessors || [] )
              return res
        }, [] as string[]) || []
        if(required){
          console.log(allProcessors,requiredProcessors,this.config.selectedPlugins)
          this.selectedRequiredProcessors = _.intersection(allProcessors,requiredProcessors)
          return this.selectedRequiredProcessors
        } else {
          return _.difference(freeProcessors,requiredProcessors)
        }
      }

      removeProcessor( details: {index:number, value:string }){
        console.log('Removed:',this.selectedRequiredProcessors,details.value)
        this.availableProgessorsFiltered(true)
        if( this.selectedRequiredProcessors.includes(details.value)){
          void this.$nextTick( ()=> {
            console.log('Reenter the obligatory data!')
            this.$q.notify({
              message:`${details.value} cannot be removed. It's a plugin dependency!`,
              type: 'negative'
            })
            this.config.selectedProcessors?.push(details.value)
           })
        }
      }

      onChange(prc:string,event: JsonFormsChangeEvent) {
        //console.log(prc/*,configKey*/,event,event.data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.config[prc as keyof GcodeGoConfig] = event.data
      }


      addUIPlugin(details:{index:number,value:string}){
        console.log('Added:',details)
        const pliugin = this.$plugins.getPluginFromRegister(details.value)
        if(pliugin){
          pliugin.activatePlugin()
          this.config.selectedProcessors?.push(...pliugin.dependencies().tightcncProcessors||[])
        }
        void this.$nextTick( ()=>{
          this.selectedRequiredProcessors = this.availableProgessorsFiltered(true)
        })

      }

      removeUIPlugin(details:{index:number,value:string}){
        console.log('Removed:',details)
        const pliugin = this.$plugins.getPluginFromRegister(details.value)
        if(pliugin){
          pliugin.deactivatePlugin()
          const mp = pliugin.dependencies().tightcncProcessors
          if(mp && this.config.selectedProcessors){
              const toRemove = _.intersection(mp,
               ...Object.values(this.$plugins._pluginRegister).map( pl=>pl.dependencies().tightcncProcessors)
              )
              _.pullAll(this.config.selectedProcessors,toRemove)
              
          }
        }
        void this.$nextTick( ()=>{
          this.selectedRequiredProcessors = this.availableProgessorsFiltered(true)
        })
      }


      onSubmit(){     
        switch(this.config.controller){
          case 'grbl':
            if(!this.config.controllers)this.config.controllers = {} as TightCNCControllers
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const acontrol = this.config.controllers[this.config.controller]
            if(acontrol)
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
        void this.$plugins.reloadPlugins()
        //console.debug('Saving:',this.config)
        this.$tightcnc.updateConfig(this.config,true)
      }

      onReset(){
        this.config = JSON.parse(JSON.stringify(this.$tightcnc.getConfig())) as Partial<TightCNCConfig>
        if(this.config.controllers && this.config.controller && this.config.controllers[this.config.controller]){
          const acontrol = this.config.controllers[this.config.controller]
          //console.log(acontrol)
          const porturl =  new URLParse(acontrol?.port ||'')
          this.portType = porturl.protocol?porturl.protocol.slice(0,-1):'serial'
          //console.log('->',this.portType,porturl)
          switch(this.portType){
            case 'http': // Special case for save without protocol
              this.portType = 'serial'
              this.port = porturl.pathname
              break;
            case 'serial':
              //console.log(acontrol)
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
        this.selectedRequiredProcessors = this.availableProgessorsFiltered(true)
      }


}
</script>

<style lang="scss">
@import '@jsonforms/vue-vanilla/vanilla.css';
</style>
