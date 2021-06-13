<template>
        <q-tabs align="center">
          <q-route-tab to="/" label="Home" />
          <q-route-tab to="/workbench" label="Workbanch" />
          <q-route-tab v-if="!$q.platform.is.electron" to="/terminal" label="Terminal" />
          <q-route-tab to="/pippo" label="404" />
          <q-route-tab v-if="!$q.platform.is.electron" to="/preferences" label="Preferences" />
        </q-tabs>

        <q-separator vertical inset />

        <q-select
          v-model="locale"
          :options="localeOptions"
          label="Language"
          dense
          borderless
          emit-value
          map-options
          options-dense
          style="min-width: 150px"
        />
</template>

<script lang="ts">
//import { QBtn } from 'quasar';
//import { ipcRenderer } from 'electron';
//import { i18n } from '../boot/i18n' 
import { Options, Vue } from 'vue-class-component';
import { useI18n  } from 'vue-i18n'

interface JsonLocale {
  [key:string]: string | JsonLocale
}


@Options({
  components: {},
  watch: {
//    '$store.state.tightcnc.lastStatus.controller.feed'(feed:number) {
//          (this as ControlWidget).feed = feed;
//    },
//    '$store.state.tightcnc.lastStatus.controller.spindle'(spindle:boolean) {
//          const controller = (this as CommandWidget).$store.state.tightcnc.lastStatus?.controller as ControllerStatus;
//          if(controller)
//            (this as CommandWidget).spindle = !spindle?'OFF':controller.spindleDirection > 0?'CW':'CWW';
//    },
  }  
})
export default class ManuWidget extends Vue {

  locale = useI18n({useScope: 'global'}).locale
  get lastStatus(){
    return this.$store.state.tightcnc.lastStatus
  }

  localeOptions = [
    { value: 'en', label: 'English'},
    { value: 'it', label: 'Italiano'}
  ]

  private i18nToObject(path:string):JsonLocale|string {
    const cp = this.$tm(path);
    if(typeof cp === 'function'){
      return this.$t(path)
    } else {
      let multy:JsonLocale = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for( let pcx in cp as any){
        multy[pcx] = this.i18nToObject(`${path}.${pcx}`)
      }
      return multy  
    }
  }

  mounted(){
    console.log(this.$q.platform)
    if(this.$q.platform.is.electron){
 //     for( let pcx in this.$tm('menu') as any){
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        //console.log('>',pcx,this.$t(`menu.${pcx}`),this.$tm(`menu.${pcx}`));
 //     }
      //console.log('------->',this.i18nToJson('menu'))
      window.api.send('PopulateApplicationMenu',this.i18nToObject('menu'))
      window.api.receive('MenuEvent',(params:{link:string})=>{       
        console.log(params)
        void this.$router.push(params.link)
      })
    }
  }

  updated(){
     if(this.$q.platform.is.electron){
       window.api.send('PopulateApplicationMenu',this.i18nToObject('menu'))
     }
 
  }

  format(num: number) {
    return num.toFixed(3 /* Precision */);
  }

}
</script>

<style lang="scss" scoped>
.zslider {
    height: 80%;
}

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
</style>
