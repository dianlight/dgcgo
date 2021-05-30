<template>
    <div class="q-pa-xs" style="max-width: 400px">
        <dynamic-form :form="form" @change="valueChanged" />
        <div>
            <q-btn label="Submit" type="submit" color="primary" :form="form.id"/>
            <q-btn label="Reset" type="reset" color="primary" flat class="q-ml-sm" />
        </div>

    </div>
</template>

<script lang="ts">
import { Controllers, Config } from '../tightcnc/TightCNC'
import { Options, Vue } from 'vue-class-component';
import {
  CheckboxField,
  TextField,
  SelectField,
  NumberField,
} from '@asigloo/vue-dynamic-forms';

@Options({})
export default class Preferences extends Vue {

    form = {
      id: 'tightcnc-config',
      fields: {
        enableServer: CheckboxField({
          label: 'Enable TightCNC Server',          
        }),  
        authKey: TextField({
          label: 'TightCNC Auth Key',        
        }),
        host: TextField({
            label: 'TightCNC Host'        
        }),
        serverPort: NumberField({
            label: 'TightCNC Server Port',
            min:1,
            max:65535,
            step: 1
        }),
        controller: SelectField({
          label: 'CNC Controller Type',
          options: [
            {
              value: Controllers.grbl,
              label: Controllers.grbl.toString(),
            },
            {
              value: Controllers.TinyG,
              label: Controllers.TinyG.toString() + '*Not yet supported*',
              disabled: true
            }
          ],
        })
      },
    }

    valueChanged(values:Config) {
      console.log('Values', values);
    }
}
</script>

<style lang="scss">
//    $input-bg: #e2eb5d52;
//    $input-border-color: #aec64c;

    @import '~@asigloo/vue-dynamic-forms/dist/themes/default.scss';
</style>
