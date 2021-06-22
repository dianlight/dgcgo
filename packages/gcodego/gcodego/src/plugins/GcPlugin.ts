import { PluginAdapter } from './PluginAdapter';

/**
 * Base class for all Plugins in GCodeGo 
 */
export abstract class GcPlugin {

    constructor(public adapter: PluginAdapter) { }

    abstract activatePlugin(): boolean
    
    abstract deactivatePlugin(): boolean

} 