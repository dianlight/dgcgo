import { PluginAdapter } from './PluginAdapter';


export interface GcPluginDependencies {
    tightcncProcessors?:string[],
    tightcncOptionalProcessors?: string[]
}

/**
 * Base class for all Plugins in GCodeGo 
 */
export abstract class GcPlugin {

    constructor(public adapter: PluginAdapter) { }

    abstract activatePlugin(): boolean
    
    abstract deactivatePlugin(): boolean

    abstract dependencies():GcPluginDependencies

} 