import { ipcRenderer, contextBridge } from 'electron'
import log from 'electron-log';

contextBridge.exposeInMainWorld('log', {
    ...log.functions,
    //    runOne(member: Exclude<keyof ElectronLog.LogFunctions, 'runOne'>, ...params:any) {
    run(member: keyof log.LogFunctions, ...params:never[]) {
        log.functions[member](...params);
    }
});

;
;
;

function invoke<T,R>(channel: string, data?:T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
        const validChannels = ['StartTightCNC', 'StopTightCNC', 'LoadTightCNCConfig'];
        if (validChannels.includes(channel)) {
            ipcRenderer.invoke(channel, data)
                .then(data => resolve(data))
                .catch(err => reject(err))
        } else {
            reject(new Error(`Invoke Invalid Channel: ${channel}`))
        }
    })
}

function send<T>(channel: string, data?:T): void {
    const validChannels = ['SaveTightCNCConfig', 'PopulateApplicationMenu'];
    if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data)
    } else {
        throw new Error(`Send Invalid Channel: ${channel}`) 
    }
}

function receive<T>(channel: string, func: (data: T) => void): Promise < T > {
    return new Promise<T>((resolve, reject) => {
        const validChannels = ['MenuEvent', 'OpenEvent'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args: unknown[]) => {
                if(func)func(args[0]  as T)
                resolve( args[0] as  T)
            } );
        } else {
            reject( new Error(`Receive Invalid Channel: ${channel}`)) 
        }
    })
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        invoke: invoke,
        send: send,
        receive: receive
    }
);

// Spectron
//console.log('--1-->', contextBridge)
//console.log('--2-->', process.argv)
//if (contextBridge.argv.indexOf('--insecure-test') > 1) {
//    console.warn("Insecure Test Environment")
//    window.require = require;
//}