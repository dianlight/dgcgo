import { GcodeLine } from './gcode-processor/GcodeLine';
import { errRegistry } from './errRegistry';
import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
//import pasync from 'pasync';
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-empty-function
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
import fs from 'fs';
import path from 'path';
import * as node_stream from 'stream'
//import objtools from 'objtools';
//import { createSchema } from 'common-schema';
//import { TightCNCServer } from '..'; // Avoid Circular dependency issue
import { BaseRegistryError } from 'new-error';
import { AbstractServer } from './AbstractServer';
import * as _ from 'lodash';
//import { GcodeProcessorOptions } from './gcode-processor/GcodeProcessorOptions';
import { ExternalizablePromise } from './ExternalizablePromise';
import { JSONSchema7 } from 'json-schema';

interface MacroMetaData {
    params: Record<string,unknown>;
    mergeParams: string[];
    isMacroMetadata: boolean;
}
interface MacroData {
        name: string;
        metadata?: MacroMetaData|void
        absPath: string;
        stat: fs.Stats;
}


export interface MacroOptions {
    gcodeProcessor?: GcodeProcessor;
    push?: (gline: GcodeLine) => Promise<void>
    sync?: () => Promise<never>
    waitSync?: boolean;
}

export class Macros {
    macroCache:{
        [key: string]:MacroData
    } = {}

    constructor(public tightcnc:AbstractServer) {
        this.tightcnc = tightcnc;
    }
    async initMacros() {
        // Load macro cache and start cache refresh loop
        await this._loadMacroCache();
        setInterval(() => {
            this._updateMacroCache()
                .catch((err) => {
                console.error('Error updating macro cache', err);
            });
        }, 10000);
    }
    
    listAllMacros() {
        const ret: {
            name: string,
            params?: unknown,
        }[] = [];
        for (const key in this.macroCache) {
            ret.push({
                name: key,
                params: this.macroCache[key].metadata && this.macroCache[key].metadata?.params
            });
        }
        return ret;
    }

    getMacroParams(name: string):Record<string,unknown>|void {
        if (!this.macroCache[name])
            throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Macro ' + name + ' not found');
        const metadata = this.macroCache[name].metadata;
        if (!metadata)
            return;
        if (!metadata.params && !metadata.mergeParams)
            return;
        const params = _.cloneDeep(metadata.params); // objtools.deepCopy(metadata.params || {}) as unknown;
        if (metadata.mergeParams) {
            let otherMacros = metadata.mergeParams;
            if (!Array.isArray(otherMacros))
                otherMacros = [otherMacros];
            this._mergeParams(params, ...otherMacros);
        }
        return params;
    }
    async _loadMacroCache() {
        const newMacroCache: {
            [key: string]: MacroData
        } = {};
        const fileObjs = await this._listMacroFiles();
        for (const fo of fileObjs) {
            try {
                fo.metadata = await this._loadMacroMetadata(await this._readFile(fo.absPath));
            }
            catch (err) {
                console.error('Error loading macro metadata', fo.name, err);
            }
            newMacroCache[fo.name] = fo;
        }
        this.macroCache = newMacroCache;
    }
    async _updateMacroCache() {
        const fileObjs = await this._listMacroFiles();
        const fileObjMap: Record<string, MacroData> = {};
        for (const fo of fileObjs)
            fileObjMap[fo.name] = fo;
        // Delete anything from the cache that doesn't exist in the new listing
        for (const key in this.macroCache) {
            if (!(key in fileObjMap))
                delete this.macroCache[key];
        }
        // For each macro file, if it has been updated (or is new) since the cache load, reload it
        for (const key in fileObjMap) {
            if (!(key in this.macroCache) || fileObjMap[key].stat.mtime.getTime() > this.macroCache[key].stat.mtime.getTime()) {
                try {
                    fileObjMap[key].metadata = await this._loadMacroMetadata(await this._readFile(fileObjMap[key].absPath));
                }
                catch (err) {
                    console.error('Error loading macro metadata', key, err);
                }
                this.macroCache[key] = fileObjMap[key];
            }
        }
    }

    async _updateMacroCacheOne(macroName: string) {
        if (!(macroName in this.macroCache)) {
            await this._updateMacroCache();
            return;
        }
        const fo = this.macroCache[macroName];
        const stat = await new Promise<fs.Stats>((resolve, reject) => {
            fs.stat(fo.absPath, (err, stat) => {
                if (err)
                    reject(err);
                else
                    resolve(stat);
            });
        });
        if ( stat.mtime.getTime() > fo.stat.mtime.getTime()) {
            try {
                fo.stat = stat;
                fo.metadata = await this._loadMacroMetadata(await this._readFile(fo.absPath));
            }
            catch (err) {
                console.error('Error loading macro metadata', macroName, err);
            }
        }
    }
    async _listMacroFiles():Promise<MacroData[]> {
        // later directories in this list take precedence in case of duplicate names
        const dirs = [path.join(__dirname, 'macro'), this.tightcnc.getFilename(undefined, 'macro', false, true, true)];
        const ret:MacroData[] = [];
        for (const dir of dirs) {
            try {
                const files = await new Promise<string[]>((resolve, reject) => {
                    fs.readdir(dir, (err, files) => {
                        if (err)
                            reject(err);
                        else
                            resolve(files);
                    });
                });
                for (const file of files) {
                    if (/\.(j|t)s$/.test(file)) {
                        const absPath = path.resolve(dir, file);
                        try {
                            
                            const stat = await new Promise<fs.Stats>((resolve, reject) => {
                                fs.stat(absPath, (err, stat) => {
                                    if (err)
                                        reject(err);
                                    else
                                        resolve(stat);
                                });
                            });
                            ret.push({
                                name: file.slice(0, -3),
                                absPath: absPath,
                                stat: stat
                            });
                        }
                        catch (err) {
                            console.error('Error stat-ing macro file ' + absPath, err);
                        }
                    }
                }
            }
            catch (err) { }
        }
        return ret;
    }

    async _loadMacroMetadata(code: string):Promise<MacroMetaData|void> {
        /* Macro metadata (parameters) is specified inside the macro file itself.  It looks like this:
         * macroMeta({ value: 'number', pos: [ 'number' ] })
         * The parameter to macroMeta is a commonSchema-style object specifying the macro parameters.
         * When running the macro, this function is a no-op and does nothing.  When extracting the
         * metadata, the macro is run, and the function throws an exception (which is then caught here).
         * When retrieving metadata, no other macro environment functions are available.  The macroMeta
         * function should be the first code executed.
         */
        // Detect if there's a call to macroMeta
        let hasMacroMeta = false;
        for (const line of code.split(/\r?\n/g)) {
            if (/^\s*macroMeta\s*\(/.test(line)) {
                hasMacroMeta = true;
                break;
            }
        }
        if (!hasMacroMeta)
            return;
        // Construct the function to call and the macroMeta function
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const fn = new AsyncFunction('tightcnc', 'macroMeta', code);
        const macroMeta = (metadata:MacroMetaData) => {
            throw { metadata, isMacroMetadata: true };
        };
        // Run the macro and trap the exception containing metadata
        let gotMacroMetadata:MacroMetaData;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await fn(this.tightcnc, macroMeta);
            throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Expected call to macroMeta() in macro');
        }
        catch (err:unknown) {
            if (err && (err as MacroMetaData).isMacroMetadata) {
                gotMacroMetadata = err as MacroMetaData;
               // TODO: what is? --> any.metadata;
            }
            else {
                throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error getting macro metadata').withMetadata(err as Record<string, any>);
            }
        }
        if (!gotMacroMetadata)
            return;
        // Return the metadata
        const metadata = gotMacroMetadata;
//        if (metadata.params) {
       //     metadata.params = createSchema(metadata.params).getData();
//        }
        return metadata;
    }
    _prepMacroParam(value: {
        [key:string]:unknown;
    }|unknown, key: string, env: {
        [key:string]:unknown
    }) {
        const axisLabels = this.tightcnc.controller?.axisLabels || [];
        // allow things that look like coordinate arrays to be accessed by their axis letters
        if (Array.isArray(value) && (value.length <= axisLabels.length || value.length < 6)) {
            for (let axisNum = 0; axisNum < value.length && axisNum < axisLabels.length; axisNum++) {
                const axis = axisLabels[axisNum].toLowerCase();
                _.set(value,axis,value[axisNum]);
                _.set(value,axis.toUpperCase(),value[axisNum]);
                if (key === 'pos' && env && !(axis in env) && !(axis.toUpperCase() in env)) {
                    env[axis] = value[axisNum];
                    env[axis.toUpperCase()] = value[axisNum];
                }
            }
        }
        return value;
    }

    _mergeParams(ourParams:Record<string,unknown>, ...otherMacroNames:string[]):Record<string,unknown> {
        for (const name of otherMacroNames) {
            const otherParams = this.getMacroParams(name);
            if (otherParams) {
                for (const key in otherParams) {
                    if (!(key in ourParams)) {
                        ourParams[key] = _.cloneDeep(otherParams[key]);  // objtools.deepCopy(otherParams[key]);
                    }
                }
            }
        }
        return ourParams;
    }
        

    async _makeMacroEnv(code:string, params:Record<string,unknown>, options:MacroOptions) {
        const env = {
            // push gcode function available inside macro.  In gcode processor, pushes onto the gcode processor stream.
            // Otherwise, sends to controller.  Tracks if the most recent sent line is executed for syncing.
            push: (gline:GcodeLine|string|string[]) => {
                if (typeof gline === 'string' || Array.isArray(gline))
                    gline = new GcodeLine(gline);
                if (options.push) {
                    void options.push(gline);
                }
                else if (options.gcodeProcessor) {
                    options.gcodeProcessor.pushGcode(gline);
                }
                else {
                    this.tightcnc.controller?.sendGcode(gline);
                }
            },
            // Waits until all sent gcode has been executed and machine is stopped
            sync: async () => {
                if (options.sync)
                    return await options.sync();
                if (options.gcodeProcessor) {
                    await options.gcodeProcessor.flushDownstreamProcessorChain();
                }
                await this.tightcnc.controller?.waitSync();
            },
            // Runs a named operation
            op: async (name: string, params: Record<string, unknown>) => {
                return this.tightcnc.runOperation(name, params);
            },
            runMacro: async (macro: string | string[], params = {}) => {
                await this.runMacro(macro, params, options);
            },
            input: async (prompt: string | Record<string, unknown> | undefined, schema: JSONSchema7 | undefined) => {
                await env.sync();
                return this.tightcnc.requestInput(prompt, schema);
            },
            message: (msg: string) => {
                this.tightcnc?.message(msg);
            },
            tightcnc: this.tightcnc,
            gcodeProcessor: options.gcodeProcessor,
            controller: this.tightcnc.controller,
            axisLabels: this.tightcnc.controller?.axisLabels,
            XError: BaseRegistryError,
            GcodeLine: GcodeLine,
            macroMeta: () => {
               // this function is a no-op in normal operation  
            },
            allparams: {}
        };
        const meta = await this._loadMacroMetadata(code);
        const schema = meta?meta.params:undefined;
        let pkeys;
        if (schema && schema.properties) {
            pkeys = Object.keys(schema.properties as Record<string, any>);
        }
        else {
            pkeys = Object.keys(params);
        }
        for (const key of pkeys) {
            if (!(key in env)) {
                const value = this._prepMacroParam(params[key], key, env);
                params[key] = value;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                env[key] = value;
            }
        }
        env.allparams = params;
        return env;
    }
    async runJS(code: string, params:Record<string, unknown> = {}, options:MacroOptions={}) {
        if (options.waitSync)
            code += '\n;await sync();';
        const env = await this._makeMacroEnv(code, params, options);
        const envKeys = Object.keys(env);
        const fnCtorArgs = envKeys.concat([code]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const fn = new AsyncFunction(...fnCtorArgs);
        const fnArgs = [];
        for (const key of envKeys) {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            fnArgs.push(env[key]);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return fn(...fnArgs);
    }
    _readFile(filename:string):Promise<string> {
        return new Promise((resolve, reject) => {
            fs.readFile(filename, { encoding: 'utf8' }, (err, data) => {
                if (err) {
                    if (err && err.code === 'ENOENT') {
                        reject(errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('File not found'));
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    resolve(data);
                }
            });
        });
    }
    /**
     * Run a macro in any of the macro formats.
     *
     * Macros are just javascript code that is executed in an environment with a few easy-to-access
     * functions and variables.  They run in a trusted context and only trusted macros should be run.
     *
     * The macro can be one of:
     * - A string, which maps to a file in the macro directory.  '.js' is automatically appended to the name.
     * - A string containing a semicolon, which is treated directly as javascript code.
     * - An array of string gcode lines.  These string gcode lines can contain substitutions as in JS backtick ``
     *   substitution.
     *
     * Macros run in a context with the following functions/variables available:
     * - tightcnc - The tightcnc instance
     * - controller - Alias for tightcnc.controller
     * - gcodeProcessor - The GcodeProcessor, if running within a GcodeProcessor context
     * - axisLabels - An array of axis labels corresponding to position arrays
     * - push(gline) - Send out a gcode line, either as a GcodeLine instance or a string (which is parsed).  If running
     *   in a GcodeProcessor context, this pushes onto the output stream.  Otherwise, the line is sent directly to
     *   the controller.
     * - sync() - Wait for all sent gcode lines to be executed.  Returns a Promise.  Use it as 'await sync();' - macros
     *   can use 'await'.
     * - op(name, params) - Runs a named tightcnc operation.  Returns a promise.
     *
     * All axis-array positions passed as parameters are detected (as numeric arrays of short length) as coordinates
     * and are assigned properties corresponding to the axis labels (ie, pos.x, pos.y, etc).  Additionally, if there is
     * a parameter named simply 'pos', the axis letters are exposed directly as variables in the macro context.
     *
     * @method runMacro
     * @param {String|String[]} macro
     * @param {Object} params - Any parameters to pass as variables to the macro.
     * @param {Object} options - Options for macro execution.
     *   @param {GcodeProcessor} options.gcodeProcessor - Provide this if running in the context of a gcode processor.  This provides
     *     the gcode processor in the environment of the macro and also causes the push() method to push onto the gcode processor's
     *     output stream instead of being directly executed on the controller.
     *   @param {Function} options.push - Provide a function for handling pushing gcode lines.
     */
    async runMacro(macro: string | string[], params:Record<string, unknown> = {}, options: MacroOptions) {
        if (typeof macro === 'string' && macro.indexOf(';') !== -1) {
            // A javascript string blob
            return this.runJS(macro, params, options);
        }
        else if (typeof macro === 'string') {
            // A filename to a javascript file
            if (macro.indexOf('..') !== -1 || path.isAbsolute(macro))
                throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('.. is not allowed in macro names');
            // Get the macro metadata
            await this._updateMacroCacheOne(macro);
            if (!this.macroCache[macro])
                throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Macro ' + macro + ' not found');
            // Normalize the params
            //const paramsSchema = this.getMacroParams(macro);
            //if (paramsSchema) {
            //    createSchema(paramsSchema).normalize(params, { removeUnknownFields: true });
            //}
            // Load the macro code
            const code = await this._readFile(this.macroCache[macro].absPath);
            if (!code)
                throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Macro ' + macro + ' not found');
            // Run the macro
            return this.runJS(code, params, options);
        }
        else if (Array.isArray(macro) && typeof macro[0] === 'string') {
            // An array of strings with substitutions
            let code = '';
            for (const str of macro) {
                code += 'push(`' + str + '`);\n';
            }
            return this.runJS(code, params, options);
        }
        else {
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Unknown macro type');
        }
    }
    generatorMacroStream(macro:string, params:any):MacroGcodeSourceStream {
        return new MacroGcodeSourceStream(this, macro, params);
    }
}
class MacroGcodeSourceStream extends node_stream.Readable {
    pushReadWaiter?:ExternalizablePromise<void>;

    constructor(macros:Macros, macro:string, macroParams?:any) {
        super({ objectMode: true });
        let gotChainError = false;
        this.on('chainerror', (err) => {
            gotChainError = true;
            if (this.pushReadWaiter) {
                this.pushReadWaiter.reject(err);
                delete this.pushReadWaiter;
            }
        });
        macros.runMacro(macro, macroParams, {
            push: async (gline:GcodeLine) => {
                const r = this.push(gline);
                if (!r) {
                    // wait until _read is called
                    if (!this.pushReadWaiter) {
                        this.pushReadWaiter = new ExternalizablePromise<void>();
                    }
                    await this.pushReadWaiter;
                }
            },
            sync: () => {
                throw errRegistry.newError('INTERNAL_ERROR','UNSUPPORTED_OPERATION').formatMessage('sync() not supported in generator macros');
            }
        })
            .then(() => {
            this.push(null);
        })
            .catch((err:Record<string, any>) => {
            if (!gotChainError) {
                this.emit('error', errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error running generator macro').withMetadata(err));
            }
        });
    }
    override _read() {
        if (this.pushReadWaiter) {
            this.pushReadWaiter.resolve();
            delete this.pushReadWaiter;
        }
    }
}
