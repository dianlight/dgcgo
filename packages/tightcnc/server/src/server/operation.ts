
import { errRegistry } from './errRegistry';
import TightCNCServer from './tightcnc-server';
import { JSONSchema7 } from 'json-schema';

/**
 * Base class for an operation that can be performed.  Operations pretty much map
 * one-to-one to API calls.
 *
 * @class Operation
 */
export default abstract class Operation {

    public config?:Record<string,any>

    constructor(public tightcnc: TightCNCServer) { }
        
    /**
     * Initialize the operation.  May return a Promise.
     *
     * @method init
     * @return {Promise|undefined}
     */
    init():Promise<void>|undefined {return }
    /**
     * Run the operation with the given params.
     *
     * @method run
     * @param {Object} params
     * @return {Mixed}
     */
    abstract run(params:any):unknown
    /**
     * Return a json-schema Schema object corresponding to the accepted parameters for the operation.
     *
     * @method getParamSchema
     * @return {Schema}
     */
    abstract getParamSchema(): JSONSchema7

    /**
     * Return a json-schema Schema object corresponding to the returned parameters from the operation.
     *
     * @method getResultSchema
     * @return {Schema}
     */
    //abstract getResultSchema(): Schema
    
    checkReady() {
        if (!this.tightcnc.controller || !this.tightcnc.controller.ready) {
            throw errRegistry.newError('INTERNAL_ERROR','BAD_REQUEST').formatMessage('Controller not ready');
        }
    }
}
