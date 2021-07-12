import { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { JobStatusUpdateHookCallback } from '../tightcnc/TightCNCClient';
import { ClientEvents, GlobalEventBus,GcPlugin, AbstractPluginAdapter } from '@dianlight/gcodego-core'
import { Notify, Dialog } from 'quasar'
import JsonFormDialog from '../dialogs/JsonFormDialog.vue'
import { RouteRecordRaw } from 'vue-router';

export class PluginAdapter extends AbstractPluginAdapter {

    registerMenuFunction(link: {menu: string, to: string; icon?: string; tooltip?: string; }): void {
        this.bus.emit(GlobalEventBus.NEW_MENU,link)
    }
    registerRoute(route: RouteRecordRaw): void {
        this.bus.emit(GlobalEventBus.NEW_ROUTE,route)
    }
    unregisterMenuFunction(menu: string): void {
        this.bus.emit(GlobalEventBus.DEL_MENU,menu)
    }
    unregisterRoute(name: string): void {
        this.bus.emit(GlobalEventBus.DEL_ROUTE,name)
    }


    override async reloadPlugins(): Promise<boolean> {
//        console.log('Available Plugins are:',this._pluginRegister)
        return new Promise((resolve) => {
            for (const kplugin of Object.keys(this._pluginRegister)) {
                this._pluginRegister[kplugin].deactivatePlugin()
                if ( this.tightcnc.getConfig().selectedPlugins?.includes(kplugin)) {
                    this._pluginRegister[kplugin].activatePlugin()
//                    console.log(`Plugin ${kplugin} enabled`)
                } else {
//                    console.log(`Plugin ${kplugin} disabled`)
                }
            }
            resolve(true)
        });
    }

    override addPluginToRegister(name: string, plugin: GcPlugin) {
        this._pluginRegister[name] = plugin
    }

    override listPluginRegister(): string[] {
        return Object.keys(this._pluginRegister)
    }

    override getPluginFromRegister(name: string): GcPlugin | undefined {
        return this._pluginRegister[name]
    }

    /**
     * Exposed API to register to events
     */

    override registerJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
        this.tightcnc.addListener('job-status-update' as ClientEvents, fn)
    }
    override unregisterJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
        this.tightcnc.removeListener('job-status-update' as ClientEvents, fn)
    }


    /**
     * Exposed API to control UI
     */
    async showDialog(caption: string, text: string, exits: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            Notify.create({
                timeout: 0,
                caption: caption,
                message: text,
                html: true,
                position: 'top-right',
                group: false,
                type: 'info',
                actions: exits.map(str => {
                    return {
                        label: str,
                        handler: () => resolve(str)
                    }
                }),
                onDismiss: () => {
                    //console.warn('Closed Dialog!')
                    reject()
                },
                closeBtn: exits.length == 0 ? true : false
            })
        })
    }

    async showJsonFormDialog<T>(text: string, schema: JsonSchema7, uischema: UISchemaElement, data?: T): Promise<T> {
        return new Promise((resolve, reject) => {
            Dialog.create({
                component: JsonFormDialog,
                position: 'standard',
                persistent: true,
                componentProps: {
                    text,
                    schema,
                    uischema,
                    data: data || {}
                }
            }).onOk((values: T) => {
                console.log('OK', values)
                resolve(values)
            }).onCancel(() => {
                console.log('Cancel')
                reject()
            }).onDismiss(() => {
                console.log('Called on OK or Cancel')
            })
        })
    }




}