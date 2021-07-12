import { GcPlugin, GcPluginDependencies } from '@dianlight/gcodego-core'
import { RouteRecordRaw } from 'vue-router';
import AutoLevelPage from 'pages/AutoLevel.vue'


export class AutoLevel extends GcPlugin {
    activatePlugin(): boolean {
        this.adapter.registerMenuFunction(            
            {menu: 'menu.view.autolevel', to: '/autolevel', icon:'calendar_view_month', tooltip:'plugin.autolevel.tooltip' }
        )
        this.adapter.registerRoute(
            { name: 'autolevel', path: 'autolevel', component: AutoLevelPage } as RouteRecordRaw
        )
        return true
    }

    deactivatePlugin(): boolean {
        this.adapter.unregisterMenuFunction('menu.view.autolevel')
        this.adapter.unregisterRoute('autolevel')
        return true
    }

    dependencies(): GcPluginDependencies {
        return {
            tightcncProcessors: ['autolevel'],
            tightcncOptionalProcessors: []
        }
    }
}