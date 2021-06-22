import { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { Client, ClientEvents, JobStatusUpdateHookCallback } from '../tightcnc/TightCNC';
import { GcPlugin } from './GcPlugin';
import { Notify,Dialog } from 'quasar'
import JsonFormDialog from '../dialogs/JsonFormDialog.vue'


export class PluginAdapter {

    _pluginRegister:Record<string,GcPlugin>={}

  constructor(public tightcnc: Client) {}

  async reloadPlugins(): Promise<boolean> {
    return new Promise((resolve) => {
      for (const kplugin of Object.keys(this._pluginRegister)) {
        this._pluginRegister[kplugin].deactivatePlugin()
        if ((this.tightcnc.getConfig().selectedPlugins || []).includes(kplugin)) {
          this._pluginRegister[kplugin].activatePlugin()
        } 
      }
      resolve(true)
    });  
  }
    
  addPluginToRegister(name: string, plugin: GcPlugin) {
      this._pluginRegister[name]=plugin
  }
    
  listPluginRegister(): string[]{
      return Object.keys(this._pluginRegister)
  }
    
  getPluginFromRegister(name: string): GcPlugin|undefined {
      return this._pluginRegister[name]
  }  
    
  /**
   * Exposed API to register to events
   */  

  registerJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
    this.tightcnc.addListener(ClientEvents.JOB_STATUS,fn)    
  }
  unregisterJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
    this.tightcnc.removeListener(ClientEvents.JOB_STATUS,fn)    
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
                        handler: ()=>resolve(str)
                    }
                }),
                onDismiss: () => {
                   //console.warn('Closed Dialog!')
                    reject()
                },
                closeBtn: exits.length == 0?true:false
            })            
        })
  }
    
    async showJsonFormDialog<T>(text: string, schema: JsonSchema7, uischema: UISchemaElement, data?:T): Promise<T>{
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
            }).onOk((values:T) => {
                console.log('OK',values)
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