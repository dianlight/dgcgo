import { ipcRenderer, contextBridge } from 'electron'
import log from 'electron-log';

//window.log = log.functions;
//window.ipcRenderer = ipcRenderer

contextBridge.exposeInMainWorld('log', {
    ...log.functions,
    //    runOne(member: Exclude<keyof ElectronLog.LogFunctions, 'runOne'>, ...params:any) {
    run(member, ...params) {
        log.functions[member](...params);
    }
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        invoke: (channel, data) => {
            let validChannels = ['StartTightCNC', 'StopTightCNC', 'LoadTightCNCConfig'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
        },
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ['SaveTightCNCConfig', 'PopulateApplicationMenu'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ['MenuEvent'];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                console.log('mount listener for', channel);
                ipcRenderer.on(channel, (event, ...args) => func(...args));
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