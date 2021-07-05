<template>
  <!-- notice dialogRef here -->
  <q-dialog ref="dialog" @hide="onDialogHide">
    <q-card class="q-dialog-plugin">

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
import { Vue, Options /*, Prop, Model, Emit*/ } from 'vue-property-decorator'


import { markRaw } from 'vue';
import { QDialog, useDialogPluginComponent } from 'quasar';
import { JSONSchema7 } from 'json-schema';
import { JsonForms, JsonFormsChangeEvent } from '@jsonforms/vue';
import {
  //  defaultStyles,
  //  mergeStyles,
  vanillaRenderers,
} from '@jsonforms/vue-vanilla';
import { UISchemaElement } from '@jsonforms/core';

class Props {
  text?: string;
  schema?: JSONSchema7;
  uischema?: UISchemaElement;
  data?: Record<string, unknown> | undefined;
}

@Options({
  components: { JsonForms },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
})
export default class JsonFormDialog extends Vue.with(Props) {

  
  // Json Form
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  renderers = Object.freeze(
    markRaw([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...vanillaRenderers,
      // here you can add custom renderers
    ])
  );

  declare $refs: {
    dialog: QDialog;
  };

  // REQUIRED; must be called inside of setup()
  //{ dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
  // dialogRef      - Vue ref to be applied to QDialog
  // onDialogHide   - Function to be used as handler for @hide on QDialog
  // onDialogOK     - Function to call to settle dialog with "ok" outcome
  //                    example: onDialogOK() - no payload
  //                    example: onDialogOK({ /*.../* }) - with payload
  // onDialogCancel - Function to call to settle dialog with "cancel" outcome

  cdata: Record<string, unknown> = {};

  onChange(event: JsonFormsChangeEvent) {
    this.cdata = event.data as Record<string, unknown>;
  }

  // following method is REQUIRED
  // (don't change its name --> "show")
  show() {
    this.$refs.dialog.show();
  }

  // following method is REQUIRED
  // (don't change its name --> "hide")
  hide() {
    this.$refs.dialog.hide();
  }

  onDialogHide() {
    // required to be emitted
    // when QDialog emits "hide" event
    this.$emit('hide');
  }

  onOKClick() {
    // on OK, it is REQUIRED to
    // emit "ok" event (with optional payload)
    // before hiding the QDialog
    this.$emit('ok', this.cdata);
    // or with payload: this.$emit('ok', { ... })

    // then hiding dialog
    this.hide();
  }

  onCancelClick() {
    // we just need to hide the dialog
    this.hide();
  }
}
</script>
