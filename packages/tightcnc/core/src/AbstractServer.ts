import { Controller, ControllerStatus } from './controller';
import EventEmitter from 'events';
import { TightCNCConfig } from './TightCNCConfig';

/*
import { registerOperations } from './file-operations';
*/
import { errRegistry } from './errRegistry';
/*
import objtools from 'objtools';
*/
import { LoggerDisk } from './logger-disk';
import { LoggerMem } from './logger-mem';
import mkdirp from 'mkdirp';
/*
import * as node_stream from 'stream'
*/
import path from 'path';
import fs from 'fs';
import { Operation } from './operation';
import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import { AbstractJobManager } from './AbstractJobManager';
import { StatusObject } from './StatusObject';
import { JobSourceOptions } from './JobSourceOptions';
import { GcodeLineReadableStream } from './gcode-processor/GcodeLineReadableStream';
import { BaseRegistryError } from 'new-error';
/*
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
import Ajv, { Schema } from 'ajv'
import * as _ from "lodash";
*/
/*

export interface StatusObject {
    controller?: ControllerStatus | undefined
    job?: JobStatus | undefined
    requestInput?: {
        prompt: any
        schema: any
        id: number
    }
    units?: 'mm' | 'in'
}

export interface JobSourceOptions {
    filename?: string | undefined,
    macro?: string | undefined,
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
    }[] | undefined 
    data?: string[],
    rawStrings?: boolean,
    dryRun?: boolean,
    job?: AbtractJobState
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
*/

/**
 * This is the central class for the application server.  Operations, gcode processors, and controllers
 * are registered here.
 *
 * @class TightCNCServer
 */
export abstract class AbstractServer extends EventEmitter {

    operations: Record<string,Operation> = {}
    baseDir: string;
    /*
    macros = new Macros(this);
    controllerClasses: {
        [key:string]:unknown
    } = {};
    */
    controller?: Controller;
    
    gcodeProcessors: Record<string, typeof GcodeProcessor> = {};
    waitingForInput?:{
        prompt: any,
        schema: any,
        waiter: any,
        id: number
    };
    /*
    waitingForInputCounter = 1;
    */
    loggerDisk?: LoggerDisk;
    loggerMem?: LoggerMem;
    messageLog?: LoggerMem;
    jobManager?: AbstractJobManager;
    /*
    ajv = new Ajv()
    


    /**
     * Class constructor.
     *
     * @constructor
     * @param {Object} config
     */
    constructor(public config?:TightCNCConfig) {
        super();
        /*
        if (!config) {
            config = littleconf.getConfig();
        }
        if (config!.enableServer === false) {
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('enableServer config flag now found.  Ensure configuration is correct - check the documentation.');
        }
        */
        this.baseDir = this.config!.baseDir;
        /*
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
     * /
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
            delete this.controller;
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
     * /
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
    */
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
    /*

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
*/
    abstract registerController(name: string, cls: any):void;

    abstract registerOperation(cls: typeof Operation):void;

    abstract registerGcodeProcessor(cls: typeof GcodeProcessor):void;

 /*   
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
            if (err instanceof Error)
                console.error(err.stack);
            throw err;
        }
    }
    */
    /**
     * Return the current status object.
     *
     * @method getStatus
     * @return {Promise{Object}}
     */
    abstract getStatus(): Promise<StatusObject>;
    
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
    abstract getGcodeSourceStream(options: Readonly<JobSourceOptions>): GcodeLineReadableStream
    
    /*
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
    */
    abstract provideInput(value: any):void;
    
    abstract cancelInput(err?:BaseRegistryError):void
}