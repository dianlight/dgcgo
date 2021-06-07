<template>
  <div class="q-pa-md">
    <q-form @submit="onSubmit" class="q-gutter-md row items-start">
    <div class="q-gutter-md row items-start">
      <q-input dense v-model="config.host" filled type="text" hint="Host" />
      <q-input dense v-model="config.serverPort" filled type="number" hint="Port" />
    </div>
    <div class="q-gutter-md row items-start">
      <q-input dense v-model="config.authKey" filled :type="isPwd ? 'password' : 'text'" hint="AuthKey">
        <template v-slot:append>
          <q-icon
            :name="isPwd ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>
    </div>
    <div class="q-gutter-md row items-start">
      <q-select dense outlined v-model="config.controller" :options="controllers" @change="changeControllerType" label="Outlined" />

      {{config.controller}}

      <q-select dense outlined v-if="config.controller === 'grbl'" v-model="portType" :options="['serial','socket','grblsim']" label="Port Type" />

      <q-input  dense outlined v-model="port" label="Port" />

      <q-select dense outlined v-model="baudRate" :options="[9600, 14400, 19200, 38400, 57600, 115200, 128000, 256000 ]" label="BaudRate" />
    </div>
      <div class="bg-grey-2 q-pa-sm rounded-borders">
        Machine available Axis
        <q-option-group
          name="usedAxes"
          v-model="usedAxes"
          :options="[{label:'X',value:true},{label:'Y',value:true},{label:'Z',value:true}]"
          type="checkbox"
          color="primary"
          inline
      />
      </div>
      <div class="q-gutter-sm">
        <q-checkbox dense v-model="usedAxes[0]" label="X" color="teal" />
        <q-checkbox dense v-model="usedAxes[1]" label="Y" color="orange" />
        <q-checkbox dense v-model="usedAxes[2]" label="Z" color="red" />
      </div>
      <div class="q-gutter-sm">
        <q-checkbox dense v-model="homableAxes[0]" label="X" color="teal" />
        <q-checkbox dense v-model="homableAxes[1]" label="Y" color="orange" />
        <q-checkbox dense v-model="homableAxes[2]" label="Z" color="red" />
      </div>   
    </q-form>
  </div>
  <q-separator/>
  <div class="q-gutter-md row items-start">
        <q-btn label="Submit" type="submit" color="primary"/>
  </div>
</template>

<script lang="ts">
import { TightCNCConfig } from 'tightcnc'
import { Options, Vue } from 'vue-class-component';

@Options({
  components: {}
})
export default class Preferences extends Vue {

      portType = 'serial'
      isPwd = true
      config:Partial<TightCNCConfig> = {}
      port = '/dev/ttyAMA0'
      baudRate = 115200
      usedAxes = [ true, true, true ]
      homableAxes =  [ true, true, true ]


      controllers = [{label:'none', value:undefined },{label:'grbl'},{label:'TinyG *Unsupported*',disable:true}]

      mounted(){
        this.config = JSON.parse(JSON.stringify(this.$store.state.tightcnc.client?.config || {})) as Partial<TightCNCConfig>
      }

      changeControllerType(){
        //
      }

      onSubmit(){
        console.log(this.config)
      }

//valueChanged(values:TightCNCConfig) {
//     console.log('Values', values);
//   }
}
</script>

<style lang="scss">
</style>
