<template>
    <q-dialog v-model="value.show">
      <q-card style="width: 300px" class="q-px-sm q-pb-md">
        <q-card-section>
          <div class="text-h6">{{ title }}</div>
        </q-card-section>

        <q-card-section>
            <q-item-label header>Axis</q-item-label>
            <q-item dense v-for="(axis,index) in ($store.state.tightcnc.lastStatus?.controller?.axisLabels || [] )" v-bind:key="axis">
            <q-item-section avatar>
                {{ axis }}
            </q-item-section>
            <q-item-section v-if="$store.state.tightcnc.lastStatus?.controller">
                <q-slider 
                color="teal" 
                v-model="value.position[index]" 
                label-always
                :min="-$store.state.tightcnc.lastStatus.controller.axisMaxTravel[index]"
                :max="$store.state.tightcnc.lastStatus.controller.axisMaxTravel[index]"
                :step="0.001" />
            </q-item-section>
            </q-item>
        </q-card-section>

        <q-card-actions align="right">
            <q-btn
                dense
                outline
                v-close-popup
            >
            Cancel
            </q-btn>
            <q-btn
                dense
                outline
                v-close-popup
                @click="moveTo"
            >
            Move
            </q-btn>
        </q-card-actions>


      </q-card>
    </q-dialog>
</template>

<script lang="ts">
import { Vue, Prop, Model, Emit } from 'vue-property-decorator'
import { PositionDialogModel } from './PositionDialogModel' 



export default class PositionDialog extends Vue {


    @Prop(String) readonly title: string | undefined
    @Model('modelValue', PositionDialogModel )
    readonly value!: PositionDialogModel

    @Emit()
    moveTo():{pos:number[],type:'machine'|'work'}{
        return {
            pos:this.value.position,
            type:this.value.type
        }
    }

}
</script>
