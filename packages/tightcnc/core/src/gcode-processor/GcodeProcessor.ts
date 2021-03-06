import * as node_stream from 'stream'
import GcodeLine from './GcodeLine';
import { errRegistry } from '../errRegistry';
import { deepCopy } from 'objtools';
import { GcodeLineReadableStream } from './GcodeLineReadableStream';
import { JSONSchema7 } from 'json-schema';
import { UISchemaElement } from '@jsonforms/core'
import * as _ from 'lodash';
import { AbstractServer } from '../AbstractServer';
import { VMState } from './VMState';
import { GcodeProcessorOptions } from './GcodeProcessorOptions';
import { JobState } from '../job-state';

export type GcodeProcessorLifeCycle = 'server-only' | 'need-ui' | 'optional-ui' | 'internal'

export abstract class GcodeProcessor extends GcodeLineReadableStream {

    id: string;
    syncWaitingForLine?:GcodeLine; // used to determine when the last line pushed from this processor is received by the next in the chain
    dryRun = false; // will be set to true in the case of a "dry run" where the gcode stream isn't sent to a real controller

    gcodeProcessorName: string;
    gcodeProcessorChain: GcodeProcessor[] = []
    gcodeProcessorChainIdx = 0
    modifiesGcode:boolean;
    processorOptions:Partial<GcodeProcessorOptions>;
    processorId:unknown;
    tightcnc:AbstractServer;
    job?:JobState|undefined;
    //preprocessInputGcode: ()=>void
    gcodeProcessorChainById: { [key: string]: GcodeProcessor; } = {};
    

    /**
     * This is the superclass for gcode processor streams.  Gcode processors can transform and analyze gcode
     * and can be chained together.
     *
     * @class GcodeProcessor
     * @constructor
     * @param {Object} options - Any options used to configure the gcode processor.  If this is executed
     *   in the context of an TightCNC Server, the 'tightcnc' option will provide a reference to it, and the
     *   'job' option will provide a reference to the JobState object.
     *   @param {String} [options.id] - Optional id to use for this processor in status reports.  Defaults
     *     to the gcode processor name.
     * @param {String} name - The name of this gcode processor.  Should be hardcoded in the subclass.
     * @param {Boolean} [modifiedGcode=true] - Set to false if this processor only records gcode lines
     *   without modifying them.  (Adding additional properties that don't affect the gcode itself doesn't
     *   count as modification)
     */
    constructor(options: GcodeProcessorOptions, name:string, modifiesGcode = true) {
        super({ objectMode: true, highWaterMark: 20 });
        this.gcodeProcessorName = name;
        this.modifiesGcode = modifiesGcode;
        this.processorOptions = options;
        this.processorId = options.id || name;
        this.tightcnc = options.tightcnc;
        this.job = options.job;
        this.id = options.id || this.constructor.name /* Missing? */
        this.preprocessInputGcode = () => {
            // This function is filled in later prior to initialization
            throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Cannot call preprocessInputGcode outside of initProcessor()');
        };
    }

    /**
     * Thi method return json-schema definition of the custom options for the controller
     */
    static getOptionSchema(): JSONSchema7 {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            $id: '/'+_.kebabCase(this.name),
        } as JSONSchema7
    }

    /**
     * Thi method return json-schema definition of the custom UI options for the controller
     * @see jsonforms
     * 
     * @returns the JSONSchema for UI (jsonform standard) or void if no UI
     */
    static getOptionUISchema(): UISchemaElement|void {
        return
    }

    static getLifeCicle(): GcodeProcessorLifeCycle {
        return 'internal'
    }
    
    /**
     * This method is called to append this gcode processor to the end of a gcode processor chain.  Normally,
     * it will just push itself onto the array.  It can also ensure that prerequisite processors are appended
     * to the chain before this one, and that extra processors (for example, to update line numbers) are
     * appended after this one.
     *
     * This method is called before initProcessor(), and is called on each processor in the chain, in order.
     *
     * @method addToChain
     * @param {GcodeProcessor[]} processorChain - Array of GcodeProcessor instances in the chain so far.
     */
    async addToChain(processorChain:GcodeProcessor[]):Promise<void> {
        processorChain.push(this);
        return Promise.resolve();
    }

    /**
     * Initializes the processor stream.  This is called in order on gcode processors in a stream.  It may
     * return a promise.  It may also call this.preprocessInputGcode() to "dry run" through all gcode
     * being input to this processor (for example, to compute needed data from the whole file).
     *
     * @method initProcessor
     */
    abstract initProcessor(): Promise<void>;

    /**
     * This method must be implemented by subclasses.  It should construct AND initialize a copy of this instance,
     * including any data already computed by initialization.  This method will only be called after this instance
     * is already initialized.  It is used to minimize reprocessing of data during initialization.
     *
     * The default implementation is just to reconstruct and reinitialize this class, which should work as
     * long as initialization isn't doing any "heavy" work.  Essentially, if initProcessor() calls
     * preprocessInputGcode(), then copyProcessor() should be overridden to copy the results instead of
     * calling preprocessInputGcode again().
     *
     * @method copyProcessor
     * @return {GcodeProcessor|Promise{GcodeProcessor}} - A copy of this instance, already initialized.
     */
    async copyProcessor():Promise<GcodeProcessor> {
//        let c = new(this.constructor)(this.processorOptions);
        const c = deepCopy(this) as GcodeProcessor;
        c.preprocessInputGcode = this.preprocessInputGcode;
        await c.initProcessor();
        return c;
    }

    /**
     * This method is added by buildProcessorChain during the processor chain initialization process, so it's
     * not a "real" class method.  It can be used only inside of initProcessor() to preprocess incoming gcode.
     * All preprocessed gcode is run through all prior gcode processors in the chain.
     *
     * @method preprocessInputGcode
     * @return {ReadableStream} - This function returns a readable object stream that outputs GcodeLine instances.
     *   After the readable stream ends, it will also contain a property `gcodeProcessorChain` which is an array
     *   of all of the prior processor instances in the chain that were used to preprocess data.  This property
     *   can be used to retrieve status information from these prior gcode processors.
     */
    abstract preprocessInputGcode(this:void): ReadableStream | void;

    /**
     * Override in subclass.  This method is called for each line of gcode, with a GcodeLine instance.  The line
     * may be transformed or analyzed.  When done, return the line to be sent to the next stage.
     *
     * This function can also return a promise, or an array of GcodeLine's, or null (to not forward on the line).
     *
     * @method processGcode
     * @param {GcodeLine} gline
     * @return {GcodeLine|GcodeLine[]|Promise|null}
     */
    abstract processGcode(gline: GcodeLine): GcodeLine | GcodeLine[] | Promise<GcodeLine | GcodeLine[]> | void;

    /**
     * Override this method to flush any cached gcode remaining.  Analog of transform stream _flush, but unlike _flush,
     * this can be called at any time, not just when the job ends.
     *
     * @method flushGcode
     * @return {GcodeLine|GcodeLine[]|Promise|null}
     */
    abstract flushGcode(): GcodeLine | GcodeLine[] | Promise<GcodeLine | GcodeLine[]> | void;

    /**
     * Return a status object to be included in job status reports.  null to not generate a status
     * report for this gcode processor.
     *
     * @method getStatus
     * @return {Partial<VMState>|void}
     */
    getStatus():Partial<VMState>|void {
        return;
    }

    // Does not represent flushed status of the processor logic itself.  Only the streams
    // buffers (this stream's write buffer the the next stream's read buffer).
    _isFlushed() {
        return !this.gcodeProcessorChain || !this.syncWaitingForLine;
    }

    /**
     * This function returns a promise that resolves once this gcode processor's internal send buffer (NOT including
     * anything the gcode processor itself has buffered) has been flushed.
     *
     * @method waitFlush
     * @return {Promise}
     */
    async waitFlush():Promise<void> {
        await new Promise<void>((resolve, reject) => {
            if (this._isFlushed()) return resolve();
            let done = false;
            this.once('_gcpFlushed', () => {
                if (done) return;
                done = true;
                resolve();
            });
            this.once('chainerror', (err:unknown) => {
                if (done) return;
                done = true;
                reject(err);
            });
        });
    }

    
    pushGcode(gline:GcodeLine|GcodeLine[]) {
        if (Array.isArray(gline)) {
            for (const l of gline) {
                this._checkFlushedOnPush(l);
                this.push(l);
            }
        } else {
            this._checkFlushedOnPush(gline);
            this.push(gline);
        }
    }

    /**
     * Flushes all gcode processors downstream from (and including) this one, then waits for their internal stream
     * buffers to clear.  Note that if data is still flowing, the streams may not be flushed anymore by the time it returns.
     * It is intended to be used from inside an async processGcode() method, where waiting this promise will
     * automatically prevent further data from being sent downstream.
     *
     * @method flushDownstreamProcessorChain
     * @return {Promise}
     */
    async flushDownstreamProcessorChain() {
        if (!this.gcodeProcessorChain) return;
        for (let i = this.gcodeProcessorChainIdx; i < this.gcodeProcessorChain.length; i++) {
            await this.gcodeProcessorChain[i].flushGcode();
            await this.gcodeProcessorChain[i].waitFlush();
        }
    }

    _checkFlushedOnPush(gline:GcodeLine) {
        if (!this.gcodeProcessorChain) return;
        this.syncWaitingForLine = gline; // use this property to store the most recently pushed gline, or null if it has been flushed
        // the last processor in the chain needs to be handled specially; add a hook and consider it flushed once sent by the controller
        if (this.gcodeProcessorChainIdx === this.gcodeProcessorChain.length - 1) {
            gline.hookSync('sent', () => {
                if (gline === this.syncWaitingForLine) {
                    delete this.syncWaitingForLine;
                    this.emit('_gcpFlushed');
                }
            });
        }
    }

    _checkFlushedOnRecv(gline:GcodeLine) {
        if (!this.gcodeProcessorChain) return;
        if (this.gcodeProcessorChainIdx < 1) return; // no previous stream to check if first in chain
        const prevProcessor = this.gcodeProcessorChain[this.gcodeProcessorChainIdx - 1];
        if (!prevProcessor) return;
        if (prevProcessor.syncWaitingForLine === gline) {
            // previous processor's write buffer, and this processor's read buffer, have now been flushed
            delete prevProcessor.syncWaitingForLine;
            prevProcessor.emit('_gcpFlushed');
        }
    }

    override _gcodeLineTransform(gcodeLine: GcodeLine, cb: node_stream.TransformCallback): void {
        this._checkFlushedOnRecv(gcodeLine);
        try {
            const r = this.processGcode(gcodeLine);
            void Promise.resolve(r).then( vr =>  cb(undefined,vr))           
        } catch (err) {
            if (err === undefined || err instanceof Error) {
                cb(err);
            } else {
                cb(new Error(JSON.stringify(err)));
            }
            return;
        }
    }

    override _flush(cb:(err?:any)=>any) {
        let r;
        try {
            r = this.flushGcode();
        } catch (err) {
            cb(err);
            return;
        }
        if (r && typeof (r as Promise<GcodeLine|GcodeLine[]>).then === 'function') {
            (r as Promise<GcodeLine|GcodeLine[]>).then((r2) => {
                try {
                    if (r2) {
                        this.pushGcode(r2);
                    }
                    cb();
                } catch (err) {
                    cb(err);
                }
            }, (err) => {
                cb(err);
            });
        } else if (r) {
            try {
                this.pushGcode(r as GcodeLine);
                cb();
            } catch (err) {
                cb(err);
            }
        } else {
            cb();
        }
    }

}

export function callLineHooks(gline:GcodeLine) {
    if (!gline.triggerSync) return;
    gline.triggerSync('queued');
    gline.triggerSync('sent');
    gline.triggerSync('ack');
    gline.triggerSync('executing');
    gline.triggerSync('executed');
}

function makeSourceStream(filename:string|string[]|(() => node_stream.Readable)):GcodeLineReadableStream {
    let lineStream;

    const glineCleanup = (gline:GcodeLine) => {
        // to remove unnecessary references and ensure these are cleaned up properly, remove all hooks from the gcode line when it's executed or errored
        gline.hookSync('executed', 1000, () => gline._hooks = {});
        gline.hookSync('error', 1000, () => gline._hooks = {});
    };

    if (Array.isArray(filename)) {
        lineStream = node_stream.Readable.from(filename);
    } else if (typeof filename === 'function') {
        return new GcodeLineReadableStream({
            gcodeLineTransform: (chunk:GcodeLine, callaback) => {
                callaback(null,glineCleanup(chunk))
            }
        }).wrap(filename())
        //filename().through((gline: GcodeLine) => {
        //    glineCleanup(gline);
        //   return gline;
        //});
    } else {
        lineStream =GcodeLineReadableStream.fromFile(filename)
    }
    return new GcodeLineReadableStream({
        gcodeLineTransform: (gline: GcodeLine, callback) => {
            glineCleanup(gline);
            callback(null,gline)
        },
    }).wrap(lineStream)
}
export class ExReadableStream extends node_stream.Transform {
    gcodeProcessorChain: GcodeProcessor[] = [];
    gcodeProcessorChainById: {
        [key:string]:GcodeProcessor
    } = {}

    constructor(opts?: node_stream.TransformOptions) {
        if (!opts) opts = {}
        if (!opts.transform) {
            opts.transform = (chunk,encoding,callback)=>callback(undefined,chunk)
        }
        super(opts)
    }
}


/**
 * Constructs and initializes a chain of gcode processors.
 *
 * @method buildProcessorChain
 * @static
 * @param {String|String[]} filename - This is either a filename of the gcode file to read, or
 *   it's an array of strings containing the gcode data (one array element per gcode line), or
 *   a function that, when called, returns a readable object stream of GcodeLine's.
 * @param {GcodeProcessor[]} processors - An array of constructed, but not initialized, gcode processor
 *   instances.  These will be added to the chain in order.  It's possible that the chain may contain
 *   additional processors not in this list if a processor's addToChain() method appends any.
 * @return {ReadableStream} - A readable stream for the output of the chain.  It's either
 *   a readable data stream or a readable object stream (of GcodeLine objects) depending
 *   on the value of the stringifyLines parameter.  The ReadableStream will also have a property
 *   `gcodeProcessorChain` that contains an array of all of the gcode processors used, and can be used
 *   to retrieve state data from processors.  This property is not available until after the 'processorChainReady'
 *   event is fired on the returned stream.
 */
export function buildProcessorChain(filename:string|string[]|(() => node_stream.Readable), processors:GcodeProcessor[]): GcodeLineReadableStream {
    // use pass through so we can return a stream immediately while doing async stuff
    const final = new GcodeLineReadableStream()
    const processorChain: GcodeProcessor[] = []

    const doBuildChain = async () => {
        // Add all list to chain
        for (const processor of processors) {
            await processor.addToChain(processorChain); // A processor can add its dependencies
        }
        // NOTE: No reorder. Missing information for orderting. ?!?!?
    }

    const doInitProcessor = async () => {
        for (const processor of processors) {
            await processor.initProcessor();
        }
    }

    void doBuildChain().then(() => {
        void doInitProcessor().then(() => {
            let prev = makeSourceStream(filename);
            for ( const processor of processors) {
                prev.pipe(processor)
                prev = processor
            }
            final.wrap(prev)
            final.emit('processorChainReady', processorChain );
        })
    })

    return final
}

