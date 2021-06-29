declare module 'crisphooks' {
    export default class CrispHooks {
        constructor(options?: {
            eventEmitter?:boolean
        })
        hook<T>(doSomething: string, callback: (value?:T) => void, errorCallback: (error:any)=>void):Promise<T>|T|void;
        trigger<T>(doSomething: string, priority?:number):Promise<T>;
        hookSync<T>(doSomething: string,priority:number, callback: (value?:T) => void):T|void;
        hookSync<T>(doSomething: string, callback: (value?:T) => void):T|void;
        hookASync<T>(doSomething: string, callback: (value?:T, next?:()=>void) => void):T|void;
        triggerASync<T>(doSomething: string, priority?: number, callback: (error: eny) => void): void;
        triggerSync<T>(doSomething: string, error?: eny): void;
        on<T>(someEvent: string,callback: (param: T) => void)
        emit<T>(someEvent: string, param: T)
        
        static addHooks(target: any)
    }

    export class CrispPrePostHooks {
        pre(doSomething: string, callback: (next: () => void) => void)
        post(doSomething: string, callback: (next: () => void) => void)
        triggerPre(doSomething: string): Promise<void>
        triggerPost(doSomething: string): Promise<void>
    }
}
