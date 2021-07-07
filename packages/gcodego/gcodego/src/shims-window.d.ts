import { LogFunctions } from 'electron-log'

interface Api {
    invoke<T,R>(channel: string, data?:T): Promise<R>;
    send<T>(channel: string, data?:T): void;
    receive<T>(channel: string, func: (data: T) => void): Promise <T>;
}

declare global {
    interface Window {
        log: LogFunctions
        api: Api
    }
}