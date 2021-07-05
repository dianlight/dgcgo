import { AbstractPluginAdapter } from './AbstractPluginAdapter';


export interface GcPluginDependencies {
    tightcncProcessors?:string[],
    tightcncOptionalProcessors?: string[]
}

/**
 * Base class for all Plugins in GCodeGo 
 */
export abstract class GcPlugin {

    constructor(public adapter: AbstractPluginAdapter) { }

    abstract activatePlugin(): boolean
    
    abstract deactivatePlugin(): boolean

    abstract dependencies():GcPluginDependencies

} 