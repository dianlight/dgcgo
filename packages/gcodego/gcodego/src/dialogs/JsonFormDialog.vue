<template>
  <!-- notice dialogRef here -->
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">
      <!--
        ...content
        ... use q-card-section for it?
      -->
      <q-card-actions>

      <json-forms
        :data="cdata"
        :renderers="renderers"
        :schema="schema"
        :uischema="uischema"
        @change="onChange"
      />
      </q-card-actions>

      <!-- buttons example -->
      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="onOKClick" />
        <q-btn color="primary" label="Cancel" @click="onCancelClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">

import { markRaw } from 'vue'
import { useDialogPluginComponent } from 'quasar'
//import { JSONSchema7 } from 'json-schema';
import { JsonForms, JsonFormsChangeEvent } from '@jsonforms/vue';
import {
//  defaultStyles,
//  mergeStyles,
  vanillaRenderers,
} from '@jsonforms/vue-vanilla';
//import { UISchemaElement } from '@jsonforms/core';

const renderers = [
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ...vanillaRenderers,
  // here you can add custom renderers
];

export default {
  props: {
    text: String,
    schema: Object, // JsonSchema7,
    uischema: Object, // UISchemaElement, 
    data:Object
  },
  components: { JsonForms },

  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],

  setup () {
    // REQUIRED; must be called inside of setup()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
    // dialogRef      - Vue ref to be applied to QDialog
    // onDialogHide   - Function to be used as handler for @hide on QDialog
    // onDialogOK     - Function to call to settle dialog with "ok" outcome
    //                    example: onDialogOK() - no payload
    //                    example: onDialogOK({ /*.../* }) - with payload
    // onDialogCancel - Function to call to settle dialog with "cancel" outcome

    const cdata = {}


    return {
      // This is REQUIRED;
      // Need to inject these (from useDialogPluginComponent() call)
      // into the vue scope for the vue html template
      dialogRef,
      onDialogHide,
      onDialogOK,

      // we can passthrough onDialogCancel directly
      onCancelClick: onDialogCancel,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      renderers: markRaw(renderers),
      cdata
    }
  },
    methods: {
      onChange(event: JsonFormsChangeEvent) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.cdata = event.data;
      },
      onOKClick(){
        // on OK, it is REQUIRED to
        // call onDialogOK (with optional payload)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.onDialogOK(this.cdata)
        // or with payload: onDialogOK({ ... })
        // ...and it will also hide the dialog automatically
      }
  },
}
</script>