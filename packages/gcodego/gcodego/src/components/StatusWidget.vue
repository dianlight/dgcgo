<template>
  <q-card>
    <q-card-section>
      <div class="q-pa-none wtable">
        <div class="row text-center">
          <div class="col text-caption">Axis</div>
          <div class="col-10 text-caption">
            <div class="row">
              <div class="col">Position</div>
            </div>
            <div class="row wsubrow">
              <div class="col text-caption">Machine</div>
              <div class="col text-caption border-left">
                <q-btn
                  round
                  outline
                  dense
                  color="primary"
                  size="xs"
                  icon="navigate_before"
                  @click="prevCoordSys"
                  :disable="controller?.activeCoordSys == 0"
                />
                Work {{ coordSystemMap[controller?.activeCoordSys||0]}}
                <q-btn
                  round
                  outline
                  dense
                  color="primary"
                  size="xs"
                  icon="navigate_next"
                  @click="nextCoordSys"
                  :disable="controller?.activeCoordSys == 5"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          class="row text-center"
          v-for="(axe, index) in controller?.axisLabels"
          :key="index"
        >
          <div class="col text-h5 text-uppercase">
            {{ axe }}
          </div>
          <div class="col-5 text-h6">
            {{ format(lastStatus?.controller?.mpos[index]) }}
            <p class="text-caption text-weight-light">
              {{ lastStatus?.controller?.units }}
            </p>
          </div>
          <div class="col-5 text-h6">
            {{ format(lastStatus?.controller?.pos[index]) }}
            <p class="text-caption text-weight-light">
              {{ lastStatus?.controller?.units }}
            </p>
          </div>
        </div>
        <div class="row text-center">
          <div class="col text-h6 text-capitalize">Status</div>
          <div class="col-8 text-h6 items-center self-end">
            <q-icon v-if="lastStatus?.controller" color="positive" name="link">
              <q-tooltip>Connected</q-tooltip>
            </q-icon>
            <q-icon
              v-if="!lastStatus?.controller"
              color="warning"
              name="link_off"
            >
              <q-tooltip>TightCNC not ready!</q-tooltip>
            </q-icon>
            <q-icon
              v-if="!lastStatus?.controller?.ready"
              color="warning"
              name="error"
            >
              <q-tooltip>{{$store.state.tightcnc.lastStatus?.controller?.errorData?.message}}</q-tooltip>
            </q-icon>
            <q-icon
              v-if="lastStatus?.controller?.moving"
              color="positive"
              name="run_circle"
            >
              <q-tooltip>Ready</q-tooltip>
            </q-icon>
            <q-icon
              v-if="lastStatus?.controller?.held"
              color="info"
              name="pending"
            >
              <q-tooltip>Hold</q-tooltip>
            </q-icon>
            <div class="row text-caption q-gutter-xs">
              <div
                v-if="0 < (lastStatus?.controller?.feed || 0)"
                class="col documentq-pa-none q-ma-none q-mt-sm"
              >
                <q-icon name="speed" /> {{ lastStatus?.controller?.feed || '0'
                }}<span class="mini">
                  {{ lastStatus?.controller?.units }}/min</span
                >
              </div>
              <div
                v-if="0 < (lastStatus?.controller?.spindleSpeed || 0)"
                class="col q-pa-none q-ma-none q-mt-sm"
              >
                <q-icon name="sync" /> {{ lastStatus?.controller?.spindleSpeed
                }}<span class="mini"> rpm</span>
              </div>
            </div>
            <q-linear-progress
              :value="progress"
              :buffer="buffer"
              class="q-mt-sm"
            />
          </div>
        </div>
        <!--
            <div class="row text-center">
                <div class="col text-h6 text-capitalize">
                    Feed
                </div>
                <div class="col-8 text-h6">
                  {{lastStatus?.controller?.feed}} {{lastStatus?.controller?.units}}/min
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
            -->
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
export default class StatusWidget extends Vue {
  get lastStatus() {
    return this.$store.state.tightcnc.lastStatus;
  }

  get controller() {
    return this.$store.state.tightcnc.lastStatus?.controller;
  }

  get buffer() {
    /* Progress in buffer */
    const controller = this.$store.state.tightcnc.lastStatus?.controller;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    if (!controller || (controller as any).comms.sendQueueLength === 0)
      return 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const tv = (controller as any).comms.sendQueueIdxToSend / (controller as any).comms.sendQueueLength;
    return tv;
  }

  get progress() {
    const controller = this.$store.state.tightcnc.lastStatus?.controller;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    if (!controller || (controller as any).comms.sendQueueLength === 0)
      return 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const tv = (controller as any).comms.sendQueueIdxToReceive / (controller as any).comms.sendQueueLength;
    return tv;
  }

  format(num?: number) {
    if (num !== undefined) return num.toFixed(3 /* Precision */);
    else return '';
  }

  coordSystemMap = [
      'G54',
      'G55',
      'G56',
      'G57',
      'G58',
      'G59',
  ]

  prevCoordSys(){
    void this.$tightcnc.op('send',{line:this.coordSystemMap[(this.controller?.activeCoordSys||1)-1],wait:true})
  }
  nextCoordSys(){
    void this.$tightcnc.op('send',{line:this.coordSystemMap[(this.controller?.activeCoordSys||0)+1],wait:true})
  }

}
</script>

<style lang="scss" scoped>
.wtable {
  border: 1px $secondary;
  border-top-style: solid;
  border-left-style: solid;
}
.wtable > div > div {
  border: 1px $secondary;
  border-style: solid;
  border-left-style: none;
  border-top-style: none;
}

.wsubrow {
    border-top: 1px $secondary solid;
}

.border-left {
    border-left: 1px $secondary solid;
}


.mini {
  font-size: smaller;
}
</style>
