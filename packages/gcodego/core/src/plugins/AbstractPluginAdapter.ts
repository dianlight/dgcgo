import { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { AbstractTightCNCClient, JobStatusUpdateHookCallback } from '../tightcnc/AbstractTightCNCClient';
import { GcPlugin } from './GcPlugin';
import { RouteRecordRaw } from 'vue-router';
import { GlobalEventBus } from '../GlobalEventBus';



export abstract class AbstractPluginAdapter {

    _pluginRegister: Record<string, GcPlugin> = {}

    constructor(public tightcnc: AbstractTightCNCClient,public bus:GlobalEventBus) { }

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

    /**
     * Set a Status Update event hook
     * @param fn the callback function
     */
    abstract registerJobStatusUpdateHook(fn: JobStatusUpdateHookCallback): void
    
    /**
     * Remove a Status Update event hook
     * @param fn the callback function
     */
    abstract unregisterJobStatusUpdateHook(fn: JobStatusUpdateHookCallback): void

    /**
     * Exposed API to add Menu Functions and Pages
     */

    /**
     * Add a new Menu
     * @param link.menu the i18n key for the menu and the menu mosition for electron app. 
     *              For example in Electron 'menu.view.autolevel' set a new submenu of view menu.
     * @param link.to the vue route destination ( the path of the page to display )
     * @param link.icon if is present is the icon to display in AppBar ( only if not Electron )
     * @param link.tooltip if id present is the tooltip of thr AppBar menu ( only if not in Electron )
     *   
     */
    abstract registerMenuFunction(       
        link: {  menu: string /*'menu.view.autolevel'*/, to: string /*'/autolevel'*/, icon?: string /*'level'*/, tooltip?: string /*'AutoLevel'*/ }
    ): void;

    /**
     * Register a new Vue Route. Useful to add Vue Pages
     * @param route the RouteRecordRaw to add
     */
    abstract registerRoute(route: RouteRecordRaw):void 

    /**
     * Remove a menu
     * @param menu the menu to remove.
     * @see registerMenuFunction
     */
    abstract unregisterMenuFunction(menu: string): void
    
    /**
     * Remove a Vuew Route p
     * @param name the RouteRecordRaw name to remove
     */
    abstract unregisterRoute(name: string):void 


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