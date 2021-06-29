//import XError from 'xerror';
//const GcodeLine = require('../../lib/gcode-line');
import { errRegistry } from './errRegistry';
import pasync from 'pasync';
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
import fs from 'fs';
import path from 'path';
//import zstreams from 'zstreams';
import * as node_stream from 'stream'
import objtools from 'objtools';
import { createSchema } from 'common-schema';
import { TightCNCServer } from '..'; // Avoid Circular dependency issue
import GcodeLine from './new-gcode-processor/GcodeLine';
import { GcodeProcessor } from './new-gcode-processor/GcodeProcessor';
import { BaseRegistryError } from 'new-error';

interface MacroData {
        name: string;
        metadata?: {
            params: unknown;
            mergeParams: boolean[];
        };
        absPath: string;
        stat: fs.Stats;
}


export interface MacroOptions {
    gcodeProcessor?: GcodeProcessor;
    push?: (gline: GcodeLine) => Promise<void>
    sync?: () => Promise<never>
    waitSync?: boolean;
}

export default class Macros {
    macroCache:{
        [key: string]:MacroData
    } = {}

    constructor(public tightcnc:TightCNCServer) {
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
    async listAllMacros() {
        let ret = [];
        for (let key in this.macroCache) {
            ret.push({
                name: key,
                params: this.macroCache[key].metadata && this.macroCache[key]!.metadata!.params
            });
        }
        return ret;
    }

    getMacroParams(name: string):any {
        if (!this.macroCache[name])
            throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Macro ' + name + ' not found');
        let metadata = this.macroCache[name].metadata;
        if (!metadata)
            return null;
        if (!metadata.params && !metadata.mergeParams)
            return null;
        let params = objtools.deepCopy(metadata.params || {});
        if (metadata.mergeParams) {
            let otherMacros = metadata.mergeParams;
            if (!Array.isArray(otherMacros))
                otherMacros = [otherMacros];
            this._mergeParams(params, ...otherMacros);
        }
        return params;
    }
    async _loadMacroCache() {
        let newMacroCache: {
            [key: string]: MacroData
        } = {};
        let fileObjs = await this._listMacroFiles();
        for (let fo of fileObjs) {
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
        let fileObjs = await this._listMacroFiles();
        let fileObjMap: {
            [key:string]: {
                name: string;
                absPath: string;
                stat: any;
                metadata?: any;
            }
        } = {};
        for (let fo of fileObjs)
            fileObjMap[fo.name] = fo;
        // Delete anything from the cache that doesn't exist in the new listing
        for (let key in this.macroCache) {
            if (!(key in fileObjMap))
                delete this.macroCache[key];
        }
        // For each macro file, if it has been updated (or is new) since the cache load, reload it
        for (let key in fileObjMap) {
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
        let fo = this.macroCache[macroName];
        let stat = await new Promise<fs.Stats>((resolve, reject) => {
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
        let dirs = [path.join(__dirname, 'macro'), this.tightcnc.getFilename(undefined, 'macro', false, true, true)];
        let ret:MacroData[] = [];
        for (let dir of dirs) {
            try {
                let files = await new Promise<string[]>((resolve, reject) => {
                    fs.readdir(dir, (err, files) => {
                        if (err)
                            reject(err);
                        else
                            resolve(files);
                    });
                });
                for (let file of files) {
                    if (/\.(j|t)s$/.test(file)) {
                        let absPath = path.resolve(dir, file);
                        try {
                            
                            let stat = await new Promise<fs.Stats>((resolve, reject) => {
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

    async _loadMacroMetadata(code: string) {
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
        for (let line of code.split(/\r?\n/g)) {
            if (/^\s*macroMeta\s*\(/.test(line)) {
                hasMacroMeta = true;
                break;
            }
        }
        if (!hasMacroMeta)
            return null;
        // Construct the function to call and the macroMeta function
        let fn = new AsyncFunction('tightcnc', 'macroMeta', code);
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'metadata' implicitly has an 'any' type.
        const macroMeta = (metadata) => {
            throw { metadata, isMacroMetadata: true };
        };
        // Run the macro and trap the exception containing metadata
        let gotMacroMetadata = null;
        try {
            await fn(this.tightcnc, macroMeta);
            throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Expected call to macroMeta() in macro');
        }
        catch (err) {
            if (err && err.isMacroMetadata) {
                gotMacroMetadata = err;
               // TODO: what is? --> any.metadata;
            }
            else {
                throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error getting macro metadata').withMetadata(err);
            }
        }
        if (!gotMacroMetadata)
            return null;
        // Return the metadata
        let metadata = gotMacroMetadata;
        if (metadata.params) {
            metadata.params = createSchema(metadata.params).getData();
        }
        return metadata;
    }
    _prepMacroParam(value: {
        [key:string]:unknown
    }, key: string, env: {
        [key:string]:unknown
    }) {
        let axisLabels = this.tightcnc.controller?.axisLabels;
        // allow things that look like coordinate arrays to be accessed by their axis letters
        if (Array.isArray(value) && (value.length <= axisLabels!.length || value.length < 6)) {
            let axisLabels = this.tightcnc.controller?.axisLabels;
            for (let axisNum = 0; axisNum < value.length && axisNum < axisLabels!.length; axisNum++) {
                let axis = axisLabels![axisNum].toLowerCase();
                value[axis] = value[axisNum];
                value[axis.toUpperCase()] = value[axisNum];
                if (key === 'pos' && env && !(axis in env) && !(axis.toUpperCase() in env)) {
                    env[axis] = value[axisNum];
                    env[axis.toUpperCase()] = value[axisNum];
                }
            }
        }
        return value;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'ourParams' implicitly has an 'any' type... Remove this comment to see the full error message
    _mergeParams(ourParams, ...otherMacroNames) {
        for (let name of otherMacroNames) {
            let otherParams = this.getMacroParams(name);
            if (otherParams) {
                for (let key in otherParams) {
                    if (!(key in ourParams)) {
                        ourParams[key] = objtools.deepCopy(otherParams[key]);
                    }
                }
            }
        }
        return ourParams;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'code' implicitly has an 'any' type.
    async _makeMacroEnv(code, params, options) {
        // @ts-expect-error ts-migrate(7034) FIXME: Variable 'env' implicitly has type 'any' in some l... Remove this comment to see the full error message
        let env;
        env = {
            // push gcode function available inside macro.  In gcode processor, pushes onto the gcode processor stream.
            // Otherwise, sends to controller.  Tracks if the most recent sent line is executed for syncing.
            push: (gline:GcodeLine|string|string[]) => {
                if (typeof gline === 'string' || Array.isArray(gline))
                    gline = new GcodeLine(gline);
                if (options.push) {
                    options.push(gline);
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
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
            op: async (name, params) => {
                return await this.tightcnc.runOperation(name, params);
            },
            // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
            runMacro: async (macro, params = {}) => {
                await this.runMacro(macro, params, options);
            },
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'prompt' implicitly has an 'any' type.
            input: async (prompt, schema) => {
                // @ts-expect-error ts-migrate(7005) FIXME: Variable 'env' implicitly has an 'any' type.
                await env.sync();
                return await this.tightcnc.requestInput(prompt, schema);
            },
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'msg' implicitly has an 'any' type.
            message: (msg) => {
                this.tightcnc.message(msg);
            },
            tightcnc: this.tightcnc,
            gcodeProcessor: options.gcodeProcessor,
            controller: this.tightcnc.controller,
            axisLabels: this.tightcnc.controller?.axisLabels,
            XError: BaseRegistryError,
            GcodeLine: GcodeLine,
            macroMeta: () => { } // this function is a no-op in normal operation
        };
        let meta = await this._loadMacroMetadata(code);
        let schema = meta && meta.params;
        let pkeys;
        if (schema && schema.type === 'object' && schema.properties) {
            pkeys = Object.keys(schema.properties);
        }
        else {
            pkeys = Object.keys(params);
        }
        for (let key of pkeys) {
            if (!(key in env)) {
                let value = this._prepMacroParam(params[key], key, env);
                params[key] = value;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                env[key] = value;
            }
        }
        (env as any).allparams = params;
        return env;
    }
    async runJS(code: string, params = {}, options:{
        waitSync?:boolean
    }={}) {
        if (options.waitSync)
            code += '\n;await sync();';
        let env = await this._makeMacroEnv(code, params, options);
        let envKeys = Object.keys(env);
        let fnCtorArgs = envKeys.concat([code]);
        let fn = new AsyncFunction(...fnCtorArgs);
        let fnArgs = [];
        for (let key of envKeys) {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            fnArgs.push(env[key]);
        }
        return await fn(...fnArgs);
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
    async runMacro(macro: string | string[], params = {}, options: MacroOptions) {
        if (typeof macro === 'string' && macro.indexOf(';') !== -1) {
            // A javascript string blob
            return await this.runJS(macro, params, options);
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
            let paramsSchema = this.getMacroParams(macro);
            if (paramsSchema) {
                createSchema(paramsSchema).normalize(params, { removeUnknownFields: true });
            }
            // Load the macro code
            let code = await this._readFile(this.macroCache[macro].absPath);
            if (!code)
                throw errRegistry.newError('INTERNAL_ERROR','NOT_FOUND').formatMessage('Macro ' + macro + ' not found');
            // Run the macro
            return await this.runJS(code, params, options);
        }
        else if (Array.isArray(macro) && typeof macro[0] === 'string') {
            // An array of strings with substitutions
            let code = '';
            for (let str of macro) {
                code += 'push(`' + str + '`);\n';
            }
            return await this.runJS(code, params, options);
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
    pushReadWaiter?:any;

    constructor(macros:Macros, macro:string, macroParams?:any) {
        super({ objectMode: true });
        let gotChainError = false;
        this.on('chainerror', (err) => {
            gotChainError = true;
            if (this.pushReadWaiter) {
                this.pushReadWaiter.reject(err);
                this.pushReadWaiter = null;
            }
        });
        macros.runMacro(macro, macroParams, {
            push: async (gline:GcodeLine) => {
                let r = this.push(gline);
                if (!r) {
                    // wait until _read is called
                    if (!this.pushReadWaiter) {
                        this.pushReadWaiter = pasync.waiter();
                    }
                    await this.pushReadWaiter.promise;
                }
            },
            sync: async () => {
                throw errRegistry.newError('INTERNAL_ERROR','UNSUPPORTED_OPERATION').formatMessage('sync() not supported in generator macros');
            }
        })
            .then(() => {
            this.push(null);
        })
            .catch((err:any) => {
            if (!gotChainError) {
                this.emit('error', errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error running generator macro').withMetadata(err));
            }
        });
    }
    override _read() {
        if (this.pushReadWaiter) {
            this.pushReadWaiter.resolve();
            this.pushReadWaiter = null;
        }
    }
}
