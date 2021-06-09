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
            <div class="row text-center" v-for="(axe, index) in lastStatus?.controller.axisLabels">
                <div class="col text-h5 text-uppercase">
                    {{ axe }}
                </div>
                <div class="col-5 text-h6">
                  {{format(lastStatus?.controller.mpos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller.units}}</p>
                </div>
                <div class="col-5 text-h6">
                   {{format(lastStatus?.controller.pos[index])}}<p class="text-caption text-weight-light">{{lastStatus?.controller.units}}</p>
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Feed
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.feed}}
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Coolant
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.coolant}}
                </div>
            </div>
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Spindle
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller.spindle}}
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

    format(num:number){
        return num.toFixed(3/* Precision */)
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