<template>
    <q-card>
      <q-card-section>
        <div class='q-pa-none wtable'>
            <div class="row text-center ">
                <div class="col text-caption">
                    Axis
                </div>
                <div class="col-5 text-caption">
                    Machine Position
                </div>
                <div class="col-5 text-caption">
                    Work Position
                </div>
            </div>
            <!-- eslint-disable-next-line vue/require-v-for-key -->
            <div class="row text-center" v-for="(axe, index) in lastStatus?.controller?lastStatus?.controller.axisLabels:[]">
                <div class="col text-h5 text-uppercase">
                    {{ axe }}
                </div>
                <div class="col-5 text-h6">
                  {{format(lastStatus?.controller?.mpos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller?.units}}</p>
                </div>
                <div class="col-5 text-h6">
                   {{format(lastStatus?.controller?.pos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller?.units}}</p>
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Status
                </div>
                <div class="col-8 text-h6 items-center self-end">
                    <q-icon v-if="lastStatus?.controller" color="positive" name="link"/> 
                    <q-icon v-if="!lastStatus?.controller" color="warning" name="link_off"/> 
                    <q-icon v-if="!lastStatus?.controller?.ready" color="warning" name="error"/> 
                    <q-icon v-if="lastStatus?.controller?.moving" color="positive" name="run_circle"/> 
                    <q-icon v-if="lastStatus?.controller?.held" color="info" name="pending"/> 
                    <q-linear-progress :value="progress" :buffer="buffer" class="q-mt-sm" />
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Coolant
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller?.coolant}}
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Spindle
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller?.spindle}}
                </div>
            </div>
        </div>
      </q-card-section>
     <!--       {{ lastStatus }} -->
    </q-card>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  components: {},
})
export default class StatusWidget extends Vue{

    get lastStatus(){
        return this.$store.state.tightcnc.lastStatus
    }

    get buffer() {
        /* Progress in buffer */
        const controller = this.$store.state.tightcnc.lastStatus?.controller; 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        if(!controller || (controller as any).comms.sendQueueLength === 0)return 0
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        const tv = (controller as any).comms.sendQueueIdxToSend / (controller as any).comms.sendQueueLength 
        return tv
    }

    get progress() {
        const controller = this.$store.state.tightcnc.lastStatus?.controller; 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        if(!controller || (controller as any).comms.sendQueueLength === 0)return 0
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        const tv = (controller as any).comms.sendQueueIdxToReceive / (controller as any).comms.sendQueueLength 
        return tv
    }

    format(num?:number){
        if(num !== undefined)
            return num.toFixed(3/* Precision */)
        else 
            return ''    
    }
}
</script>

<style lang="scss" scoped>

.wtable {
    border: 1px $secondary;
    border-top-style: solid;
    border-left-style: solid;
}
.wtable>div>div {
    border: 1px $secondary;
    border-style: solid;
    border-left-style: none;
    border-top-style: none;
}
</style>