import { registerOperations } from './file-operations';
import { errRegistry } from './errRegistry';
import objtools from 'objtools';
import LoggerDisk from './logger-disk';
import LoggerMem from './logger-mem';
import mkdirp from 'mkdirp';
import * as node_stream from 'stream'
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import JobManager, { JobStatus } from './job-manager';
import stable from 'stable';
import Macros, { MacroOptions } from './macros';
import pasync from 'pasync';
import { createSchema } from 'common-schema';
import littleconf from 'littleconf'
import joboperations from './job-operations'
import macrooperation from './macro-operations'
import basicoperation from './basic-operations'
import systemoperation from './system-operations'
import Controller, { ControllerStatus } from './controller';
import JobState from './job-state';
import GcodeLine from './new-gcode-processor/GcodeLine';
import { BaseRegistryError } from 'new-error';
import { addExitCallback, CatchSignals } from 'catch-exit';
import { registerGcodeProcessors } from './new-gcode-processor'
import { GcodeLineReadableStream } from './new-gcode-processor/GcodeLineReadableStream';
import { buildProcessorChain, GcodeProcessor } from './new-gcode-processor/GcodeProcessor';

import { TinyGController } from './tinyg-controller'
import { GRBLController } from './grbl-controller'
import { registerServerComponents } from '../plugins'
import Operation from './operation';
import Ajv from 'ajv'
import * as _ from "lodash";

export interface StatusObject {
    controller?: ControllerStatus
    job?: JobStatus
    requestInput?: {
        prompt: any
        schema: any
        id: number
    }
    units?: 'mm' | 'in'
}

export interface JobSourceOptions {
    filename?: string,
    macro?: string,
    macroParams?: any,
    rawFile?: boolean,
    gcodeProcessors?: {
        name: string,
        options: {
            id: string
            updateOnHook?: string
        },
        order?: number
        inst?: GcodeProcessor
    }[]
    data?: string[],
    rawStrings?: boolean,
    dryRun?: boolean,
    job?: JobState
}

export type TightCNCGrblConfig = {
            // serial port settings
            port: string, // '/dev/ttyACM1',
            baudRate: number,
            dataBits: number,
            stopBits: 1|0,
            parity: 'none',

            usedAxes: [boolean, boolean, boolean],
            homableAxes: [boolean, boolean, boolean]
}

export type TightCNCTinyGConfig = {
            // serial port settings
            port: string,
            baudRate: number,
            dataBits: number,
            stopBits: 1|0,
            parity: 'none',
            rtscts: boolean,
            xany: boolean,

            usedAxes: [ boolean, boolean, boolean, boolean, boolean, boolean ], // which axes of xyzabc are actually used
            homableAxes: [ boolean, boolean, boolean ], // which axes can be homed

            // This parameter governs how "aggressive" we can be with queueing data to the device.  The tightcnc controller
            // software already adjusts data queueing to make sure front-panel commands can be immediately handled, but
            // sometimes the tinyg seems to get desynced, and on occasion, it seems to crash under these circumstances
            // (with an error similar to "cannot get planner buffer").  If this is happening to you, try reducing this number.
            // The possible negative side effect is that setting this number too low may cause stuttering with lots of fast
            // moves.  Setting this to 4 is the equivalent of the tinyg "line mode" protocol.
            maxUnackedRequests: number
}

export type TightCNCControllers = {
        TinyG?: TightCNCTinyGConfig,
        grbl?: TightCNCGrblConfig
}

export interface TightCNCConfig {
    enableServer: boolean,
    baseDir: string,
    authKey: string, //'abc123',
    serverPort: number, // 2363,
    host: string, //'http://localhost',
    controller: keyof TightCNCControllers,
    controllers: TightCNCControllers,
    paths: {
        [key:string]:string,
        data: string,
        log: string,
        macro: string
    },
    plugins: string[],
    operations: {
        probeSurface: {
            defaultOptions: {
                probeSpacing: number,
                probeFeed: number,
                clearanceHeight: number,
                autoClearance: boolean,
                autoClearanceMin: number,
                probeMinZ: number,
                numProbeSamples: number,
                extraProbeSampleClearance: number
            }
        }
    },
    logger: {
        maxFileSize: number,
        keepFiles: number
    },
    loggerMem:{
        size: number;
        shiftBatchSize: number;
    }
    messageLog:{
        size: number;
        shiftBatchSize: number;
    }
    recovery: {
        // rewind this number of seconds before the point where the job stopped
        backUpTime: number,
        // additionall back up for this number of lines before that (to account for uncertainty in which lines have been executed)
        backUpLines: number,
        // This is a list of gcode lines to execute to move the machine into a clearance position where it won't hit the workpiece
        // The values {x}, {y}, etc. are replaced with the coordinates of the position (touching the workpiece) to resume the job.
        moveToClearance: string[],
        // List of gcode lines to execute to move from the clearance position to the position to restart the job.
        moveToWorkpiece: string[]
    },
    toolChange: {
        preToolChange: string[],
        postToolChange: string[],
        // Which axis number tool offsets apply to (in standard config, Z=2)
        toolOffsetAxis: number,
        negateToolOffset: boolean
    },
    enableDebug: boolean,
    debugToStdout: boolean,
    suppressDuplicateErrors?: boolean
}

/**
 * This is the central class for the application server.  Operations, gcode processors, and controllers
 * are registered here.
 *
 * @class TightCNCServer
 */
export default class TightCNCServer extends EventEmitter {

    operations: Record<string,Operation> = {}
    baseDir:string;
    macros = new Macros(this);
    controllerClasses: {
        [key:string]:unknown
    } = {};
    controller?:Controller;
    gcodeProcessors:Record<string,typeof GcodeProcessor> = {};
    waitingForInput?:{
        prompt: any,
        schema: any,
        waiter: any,
        id: number
    };
    waitingForInputCounter = 1;
    loggerDisk?: LoggerDisk;
    loggerMem?: LoggerMem;
    messageLog?: LoggerMem;
    jobManager?: JobManager;
    
    ajv = new Ajv()
    


    /**
     * Class constructor.
     *
     * @constructor
     * @param {Object} config
     */
    constructor(public config?:TightCNCConfig) {
        super();
        if (!config) {
            config = littleconf.getConfig();
        }
        if (config!.enableServer === false) {
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('enableServer config flag now found.  Ensure configuration is correct - check the documentation.');
        }
        this.baseDir = this.config!.baseDir;
        // Register builtin modules
        //import('./tinyg-controller').then((namespace)=>this.registerController('TinyG',namespace.default))
        //import('./grbl-controller').then((namespace) => this.registerController('grbl', namespace.default));
        
        this.registerController('TinyG',TinyGController)
        this.registerController('grbl',GRBLController)

        basicoperation(this);
        systemoperation(this);
        registerOperations(this);
        joboperations(this);
        macrooperation(this);
        registerGcodeProcessors(this);
        
        // {new(consoleui:ConsoleUI):JobOption}
//        import('../../lib/gcode-processors/gcode-vm').then((namespace) => this.registerGcodeProcessor('gcodevm',namespace.default))
        // Register bundled plugins
       // import('../plugins').then( (namespace) => namespace.registerServerComponents(this));
        registerServerComponents(this)
        // Register external plugins
        /*
        for (let plugin of (this.config!.plugins || [])) {
            import(plugin).then((p) => {
                if (p.registerServerComponents) {
                    p.registerServerComponents(this);
                }                    
            })
        }
        */
    }
    /**
     * Initialize class.  To be called after everything's registered.
     *
     * @method initServer
     */
    async initServer() {
        // Whether to suppress duplicate error messages from being output sequentially
        const suppressDuplicateErrors = this.config!.suppressDuplicateErrors === undefined ? true : this.config!.suppressDuplicateErrors;
        // Create directories if missing
        this.getFilename(undefined, 'data', true, true, true);
        this.getFilename(undefined, 'macro', true, true, true);
        // Initialize the disk and in-memory communications loggers
        this.loggerDisk = new LoggerDisk(this.config!.logger, this);
        await this.loggerDisk.init();
        this.loggerMem = new LoggerMem(this.config!.loggerMem || {});
        this.loggerMem.log('other', 'Server started.');
        this.loggerDisk.log('other', 'Server started.');
        // Initialize the message log
        this.messageLog = new LoggerMem(this.config!.messageLog || {});
        this.messageLog.log('Server started.');
        // Initialize macros
        await this.macros.initMacros();
        // Set up the controller
        if (this.config!.controller) {
            let controllerClass = this.controllerClasses[this.config!.controller];
            let controllerConfig = this.config!.controllers[this.config!.controller];
            this.controller = new (<any>controllerClass)(controllerConfig);
            let lastError:string|undefined; // used to suppress duplicate error messages on repeated connection retries
            this.controller?.on('error', (err) => {
                let errrep = JSON.stringify(err.toObject ? err.toObject() : err.toString) + err;
                if (objtools.deepEquals(errrep, lastError) && suppressDuplicateErrors)
                    return;
                lastError = errrep;
                console.error('Controller error: ', err);
                if (err.toObject)
                    console.error(err.toObject());
                if (err.stack)
                    console.error(err.stack);
            });
            this.controller?.on('ready', () => {
                lastError = undefined;
                console.log('Controller ready.');
            });
            this.controller?.on('sent', (line:string) => {
                this.loggerMem?.log('send', line);
                this.loggerDisk?.log('send', line);
            });
            this.controller?.on('received', (line:string) => {
                this.loggerMem?.log('receive', line);
                this.loggerDisk?.log('receive', line);
            });
            this.controller?.on('message', (msg) => {
                this.message(msg);
            });
            this.controller?.initConnection(true);
        }
        else {
            console.log('WARNING: Initializing without a controller enabled.  For testing only.');
            this.controller = undefined;
        }
        // Set up the job manager
        this.jobManager = new JobManager(this);
        await this.jobManager.initialize();
        // Initialize operations
        for (let opname in this.operations) {
            await this.operations[opname].init();
        }
        // Setup Exit Hooks

        addExitCallback((signal: CatchSignals, exitCode?: number, error?: Error) => {
            console.log('Controller shutdown for Signal ', signal, exitCode)
            if (signal === 'uncaughtException') {
                console.error(error)         
            } 
            if (signal !== 'exit') {
                this.controller?.disconnect()
            }
        });
        
    }

    /**
     * Graceful shutwown server
     */
    async shutdown(): Promise<void>{
        return new Promise((resolve) => {
            if (this.controller) {
                this.controller.disconnect().then( ()=> process.exit(0))
            } else {
                process.exit(0)
            }
        })
    }


    message(msg:string) {
        this.messageLog?.log(msg);
        this.loggerMem?.log('other', 'Message: ' + msg);
        this.loggerDisk?.log('other', 'Message: ' + msg);
    }
    debug(str:string) {
        if (!this.config!.enableDebug)
            return;
        if (this.config!.debugToStdout) {
            console.log('Debug: ' + str);
        }
        if (this.loggerDisk) {
            this.loggerDisk.log('other', 'Debug: ' + str);
        }
    }

    getFilename(name?:string, place?:string, allowAbsolute = false, createParentsIfMissing = false, createAsDirIfMissing = false) {
        if (name && path.isAbsolute(name) && !allowAbsolute)
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Absolute paths not allowed');
        if (name && name.split(path.sep).indexOf('..') !== -1 && !allowAbsolute)
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('May not ascend directories');
        let base = this.baseDir;
        if (place) {
            let placePath = this.config!.paths[place];
            if (!placePath)
                throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('No such place ' + place);
            base = path.resolve(base, placePath);
        }
        if (name) {
            base = path.resolve(base, name);
        }
        let absPath = base;
        if (createParentsIfMissing) {
            mkdirp.sync(path.dirname(absPath));
        }
        if (createAsDirIfMissing) {
            if (!fs.existsSync(absPath)) {
                fs.mkdirSync(absPath);
            }
        }
        return absPath;
    }

    getDirectory(place?:string, createParentsIfMissing = false, createAsDirIfMissing = false) {
        let base = this.baseDir;
        if (place) {
            let placePath = this.config!.paths[place];
            if (!placePath)
                throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('No such place ' + place);
            base = path.resolve(base, placePath);
        }
        let absPath = base;
        if (createParentsIfMissing) {
            mkdirp.sync(path.dirname(absPath));
        }
        if (createAsDirIfMissing) {
            if (!fs.existsSync(absPath)) {
                fs.mkdirSync(absPath);
            }
        }
        return absPath;
    }

    registerController(name:string, cls:any) {
        this.controllerClasses[name] = cls;
    }
    registerOperation(cls: typeof Operation) {
        const opr: Operation = new (cls as any)(this);
        const validate = this.ajv.compile(opr.getParamSchema())
        const name = opr.getParamSchema().$id?.slice(1) as string
        if(this.operations[name])throw errRegistry.newError('INTERNAL_ERROR','UNSUPPORTED_OPERATION').formatMessage('Duble registration of operation: ' + name);
        opr.config = (this.config!.operations as any)[name]
        this.operations[name] = opr
    }

    registerGcodeProcessor(cls: typeof GcodeProcessor) {
        const name = _.camelCase(cls.getOptionSchema().$id?.slice(1)|| cls.toString())
        this.gcodeProcessors[name] = cls;
    }

    async runOperation(opname:string, params:any) {
        if (!(opname in this.operations)) {
            throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('No such operation: ' + opname);
        }
        try {
            return await this.operations[opname].run(params);
        }
        catch (err) {
            console.error('Error running operation ' + opname);
            console.error(err);
            if (err.stack)
                console.error(err.stack);
            throw err;
        }
    }
    /**
     * Return the current status object.
     *
     * @method getStatus
     * @return {Promise{Object}}
     */
    async getStatus():Promise<StatusObject> {
        let statusObj: StatusObject = {};
        // Fetch controller status
        statusObj.controller = this.controller ? this.controller.getStatus() : undefined;
        // Fetch job status
        statusObj.job = this.jobManager ? this.jobManager.getStatus() : undefined;
        // Emit 'statusRequest' event so other components can modify the status object directly
        this.emit('statusRequest', statusObj);
        // Add input request
        if (this.waitingForInput) {
            statusObj.requestInput = {
                prompt: this.waitingForInput.prompt,
                schema: this.waitingForInput.schema,
                id: this.waitingForInput.id
            };
        }
        // Return status
        return statusObj;
    }
    /**
     * Returns a stream of gcode data that can be piped to a controller.
     *
     * @method getGcodeSourceStream
     * @param {Object} options
     *   @param {String} options.filename - Filename to read source gcode from.
     *   @param {String[]} options.data - Array of gcode line strings.  Can be supplied instead of filename.
     *   @param {Mixed} options.macro - Use a macro as a source.  Can be supplied instead of filename.
     *   @param {Object} options.macroParams - Parameters when using options.macro
     *   @param {Object[]} options.gcodeProcessors - The set of gcode processors to apply, in order, along with
     *     options for each.  These objects are modified by this function to add the instantiated gcode processor
     *     instances under the key 'inst' (unless the 'inst' key already exists, in which case it is used).
     *     @param {String} options.gcodeProcessors.#.name - Name of gcode processor.
     *     @param {Object} options.gcodeProcessors.#.options - Additional options to pass to gcode processor constructor.
     *     @param {Number} [options.gcodeProcessors.#.order] - Optional order number.  Gcode processors with associated order numbers
     *       are reordered according to the numbers.
     *   @param {Boolean} options.rawStrings=false - If true, the stream returns strings (lines) instead of GcodeLine instances.
     *   @param {Boolean} options.dryRun=false - If true, sets dryRun flag on gcode processors.
     *   @param {JobState} options.job - Optional job object associated.
     * @return {ReadableStream} - a readable object stream of GcodeLine instances.  The stream will have
     *   the additional property 'gcodeProcessorChain' containing an array of all GcodeProcessor's in the chain.  This property
     *   is only available once the 'processorChainReady' event is fired on the returned stream;
     */
    getGcodeSourceStream(options: Readonly<JobSourceOptions> ): GcodeLineReadableStream {
        // Handle case where returning raw strings
        if (options.rawStrings) {
            if (options.filename) {
                let filename = options.filename;
                filename = this.getFilename(filename, 'data', true);
                return GcodeLineReadableStream.fromFile(filename)
            }
            else if (options.macro) {
                return new GcodeLineReadableStream({
                    gcodeLineTransform: (chunk:GcodeLine, callback) => {
                        callback(null, chunk.toString())
                    }
                }).wrap(this.macros.generatorMacroStream(options.macro, options.macroParams || {}))
               // this.macros.generatorMacroStream(options.macro, options.macroParams || {}).through((gline: GcodeLine) => gline.toString());
            }
            else {
                return GcodeLineReadableStream.fromArray(options.data as string[]);
            }
        }
        // 
        let macroStreamFn:(() => node_stream.Readable)|undefined;
        if (options.macro) {
            macroStreamFn = () => {
                return this.macros.generatorMacroStream(options.macro as string, options.macroParams || {});
            };
        }

        // Sort gcode processors
        let sortedGcodeProcessors = stable(options.gcodeProcessors || [], (a:any, b:any) => {
            let aorder, border;
            if ('order' in a)
                aorder = a.order;
            else if (a.name && this.gcodeProcessors[a.name] && 'DEFAULT_ORDER' in this.gcodeProcessors[a.name])
                aorder = (this.gcodeProcessors[a.name] as any).DEFAULT_ORDER;
            else
                aorder = 0;
            if ('order' in b)
                border = b.order;
            else if (b.name && this.gcodeProcessors[b.name] && 'DEFAULT_ORDER' in this.gcodeProcessors[b.name])
                border = (this.gcodeProcessors[b.name] as any).DEFAULT_ORDER;
            else
                border = 0;
            if (aorder > border)
                return 1;
            if (aorder < border)
                return -1;
            return 0;
        });

        // Construct gcode processor chain
        let gcodeProcessorInstances: GcodeProcessor[] = [];
        for (let gcpspec of sortedGcodeProcessors) {
            if (gcpspec.inst) {
                if (options.dryRun !== undefined)
                    gcpspec.inst.dryRun = options.dryRun;
                gcodeProcessorInstances.push(gcpspec.inst);
            } else {
                let cls = this.gcodeProcessors[gcpspec.name];
                if (!cls)
                    throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Gcode processor not found: ' + gcpspec.name);
                let opts = objtools.deepCopy(gcpspec.options || {});
                opts.tightcnc = this;
                if (options.job)
                    opts.job = options.job;
                let inst = new (cls as any)(opts,gcpspec.name);
                if (options.dryRun)
                    inst.dryRun = true;
                gcpspec.inst = inst;
                gcodeProcessorInstances.push(inst);
            }
        }
        
        if(options.filename)return buildProcessorChain(options.filename, gcodeProcessorInstances);
        else if(options.data)return buildProcessorChain(options.data, gcodeProcessorInstances);
        else if (macroStreamFn) return buildProcessorChain(macroStreamFn, gcodeProcessorInstances);
        
        throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Unable to create GCODE stream')
    }

    async runMacro(macro: string | string[], params = {}, options: MacroOptions) {
        return await this.macros.runMacro(macro, params, options);
    }

    async requestInput(prompt?:string|object, schema?:any):Promise<any>{
        if (prompt && typeof prompt === 'object' && !schema) {
            schema = prompt;
            prompt = undefined;
        }
        if (schema) {
            if (typeof schema.getData !== 'function') {
                schema = createSchema(schema);
            }
            schema = schema.getData();
        }
        if (!prompt)
            prompt = 'Waiting ...';
        if (this.waitingForInput) {
            await this.waitingForInput.waiter.promise;
            return await this.requestInput(prompt, schema);
        }
        this.waitingForInput = {
            prompt: prompt,
            schema: schema,
            waiter: pasync.waiter(),
            id: this.waitingForInputCounter++
        };
        let result = await this.waitingForInput.waiter.promise;
        return result;
    }

    provideInput(value:any) {
        if (!this.waitingForInput)
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Not currently waiting for input');
        let w = this.waitingForInput;
        this.waitingForInput = undefined;
        w.waiter.resolve(value);
    }
    cancelInput(err?:BaseRegistryError) {
        if (!err)
            err = errRegistry.newError('INTERNAL_ERROR','CANCELLED').formatMessage('Requested input cancelled');
        if (!this.waitingForInput)
            return;
        let w = this.waitingForInput;
        this.waitingForInput = undefined;
        w.waiter.reject(err);
    }
}