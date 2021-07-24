import { Controller } from './controller';
import EventEmitter from 'events';
import { TightCNCConfig } from './TightCNCConfig';


import { errRegistry } from './errRegistry';
import { LoggerDisk } from './logger-disk';
import { LoggerMem } from './logger-mem';
import mkdirp from 'mkdirp';

import path from 'path';
import fs from 'fs';
import { Operation } from './operation';
import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import { AbstractJobManager } from './AbstractJobManager';
import { StatusObject } from './StatusObject';
import { JobSourceOptions } from './JobSourceOptions';
import { GcodeLineReadableStream } from './gcode-processor/GcodeLineReadableStream';
import { BaseRegistryError } from 'new-error';
import { JSONSchema7 } from 'json-schema';
import { Macros, MacroOptions } from './macros';

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
    macros?: Macros;
    /*
    ajv = new Ajv()
    


    /**
     * Class constructor.
     *
     * @constructor
     * @param {Object} config
     */
    constructor(public config:TightCNCConfig) {
        super();
        /*
        if (!config) {
            config = littleconf.getConfig();
        }
        if (config!.enableServer === false) {
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('enableServer config flag now found.  Ensure configuration is correct - check the documentation.');
        }
        */
        this.baseDir = this.config.baseDir;
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
    */

    message(msg:string) {
        this.messageLog?.log(msg);
        this.loggerMem?.log('other', 'Message: ' + msg);
        this.loggerDisk?.log('other', 'Message: ' + msg);
    }
    
    debug(str:string) {
        if (!this.config.enableDebug)
            return;
        if (this.config.debugToStdout) {
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
            const placePath = this.config.paths[place];
            if (!placePath)
                throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('No such place ' + place);
            base = path.resolve(base, placePath);
        }
        if (name) {
            base = path.resolve(base, name);
        }
        const absPath = base;
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

    abstract registerGcodeProcessor(cls: typeof GcodeProcessor): void;
    
    abstract runOperation(opname: string, params: Record<string,unknown>): Promise<unknown>;
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
    
    
    async runMacro(macro: string | string[], params = {}, options: MacroOptions):Promise<void> {
        if(this.macros)return this.macros.runMacro(macro, params, options)
        throw new Error('Nom macro engine!');
    }


    
    abstract requestInput(prompt?: string | Record<string, unknown>, schema?: JSONSchema7): Promise<unknown>;
    
    abstract provideInput(value: unknown):void;
    
    abstract cancelInput(err?:BaseRegistryError):void
}