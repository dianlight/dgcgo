import { ipcRenderer, contextBridge } from 'electron'
import log from 'electron-log';

//window.log = log.functions;
//window.ipcRenderer = ipcRenderer

contextBridge.exposeInMainWorld('log', {
    ...log.functions,
    //    runOne(member: Exclude<keyof ElectronLog.LogFunctions, 'runOne'>, ...params:any) {
    run(member: keyof log.LogFunctions, ...params:never[]) {
        log.functions[member](...params);
    }
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        invoke: (channel:string, data:never) => {
            const validChannels = ['StartTightCNC', 'StopTightCNC', 'LoadTightCNCConfig'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
        },
        send: (channel:string, data:never) => {
            // whitelist channels
            const validChannels = ['SaveTightCNCConfig', 'PopulateApplicationMenu'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receive: (channel:string, func:(...args:any[])=>void) => {
            const validChannels = ['MenuEvent', 'OpenEvent'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                console.log('mount listener for', channel);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ipcRenderer.on(channel, (event, ...args:any[]) => func(...args));
            }
        }
    }
);

// Spectron
//console.log('--1-->', contextBridge)
//console.log('--2-->', process.argv)
//if (contextBridge.argv.indexOf('--insecure-test') > 1) {
//    console.warn("Insecure Test Environment")
//    window.require = require;
//}