import { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { AbstractTightCNCClient, ClientEvents, JobStatusUpdateHookCallback } from 'src/tightcnc/AbstractTightCNCClient';
import { GcPlugin } from './GcPlugin';


export abstract class AbstractPluginAdapter {

    _pluginRegister: Record<string, GcPlugin> = {}

    constructor(public tightcnc: AbstractTightCNCClient) { }

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
        this._pluginRegister[name] = plugin
    }

    listPluginRegister(): string[] {
        return Object.keys(this._pluginRegister)
    }

    getPluginFromRegister(name: string): GcPlugin | undefined {
        return this._pluginRegister[name]
    }

    /**
     * Exposed API to register to events
     */

    registerJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
        this.tightcnc.addListener('job-status-update' as ClientEvents, fn)
    }
    unregisterJobStatusUpdateHook(fn: JobStatusUpdateHookCallback) {
        this.tightcnc.removeListener('job-status-update' as ClientEvents, fn)
    }


    /**
     * Exposed API to control UI
     */

    /**
     * Display a generic dialog/notify
     * 
     * @param caption Caption of the notify 
     * @param text Text of the notify
     * @param exits array of possible exits/buttons
     */
    abstract showDialog(caption: string, text: string, exits: string[]): Promise<string>;
    
    /**
     * Display a complex disalog with form
     * 
     * @param text Text/Title of the dialog
     * @param schema JsonSchema for the data form
     * @param uischema  UI Schema for the data form
     * @param data Actual data form
     */
    abstract showJsonFormDialog<T>(text: string, schema: JsonSchema7, uischema: UISchemaElement, data?: T): Promise<T>;




}