/**
 * A Promise that can be resolved or rejected from an external source.
 **/
export class ExternalizablePromise<T> implements Promise<T> {
    private _promise;
    private _resolve?: (value: T | PromiseLike<T>) => void;
    private _reject?: (reason?: unknown) => void;
    
    /**
     * Costructor   
     */
    constructor() {
        this._promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        })
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
        return this._promise.then(onfulfilled, onrejected);
    }
    catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult> {
        return this._promise.catch(onrejected);
    }

    finally(onfinally?: (() => void) | null): Promise<T> {
        return this._promise.finally(onfinally);
    }

    /** 
     * Resolve function
     */
    resolve(value: T | PromiseLike<T>): void {
         if(this._resolve)this._resolve(value);
    }

    /**
     * Reject function
     */
    reject(reason?: unknown): void {
        if(this._reject)this._reject(reason);
    }
    
    [Symbol.toStringTag]: string;
}
    