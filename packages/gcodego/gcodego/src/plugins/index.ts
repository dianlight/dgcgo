import { PluginAdapter } from './PluginAdapter';
import { ToolChange } from './ToolChange';


export function registerInternalPlugins(client: PluginAdapter): void{
    client.addPluginToRegister('ToolChange',new ToolChange(client))
}