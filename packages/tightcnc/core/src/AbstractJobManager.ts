//import objtools from 'objtools';
//import { JobState, ERRORCODES, errRegistry } from './index';
//import * as node_stream from 'stream'
//import { callLineHooks, GcodeProcessor } from './index';
//import { JobSourceOptions } from "./index";
//import { BaseRegistryError } from 'new-error';
//import { GcodeLine } from './index';
//import fs from 'fs'
//import { GcodeLineReadableStream, JobStatus } from './index';
import { AbstractServer } from './AbstractServer';
import { JobState } from './job-state';
import { JobStatus } from './job-status';
import { JobSourceOptions } from './JobSourceOptions';

export abstract class AbstractJobManager {

    currentJob?:JobState;

    constructor(public tightcnc:AbstractServer) {
    }

    abstract initialize():void;


    abstract getStatus(job?: JobState): JobStatus | undefined;
    /*

    _mainJobStats(gcodeProcessorStats: Record<string,Record<string,any>>):Record<string,any> {
        if (!gcodeProcessorStats || !gcodeProcessorStats['final-job-vm'])
            return { time: 0, line: 0, lineCount: 0 };
        return {
            time: gcodeProcessorStats['final-job-vm'].totalTime,
            line: gcodeProcessorStats['final-job-vm'].line,
            lineCount: gcodeProcessorStats['final-job-vm'].lineCounter
        };
    }
    */
    /**
     * Start running a job on the machine.
     *
     * @method startJob
     * @param {Object} jobOptions
     *   @param {String} jobOptions.filename - The input gcode file for the job.
     *   @param {Mixed} jobOptions.macro - Instead of filename, get the gcode from a generator macro
     *   @param {Object} jobOptions.macroParams - Parameters for the macro if running job from macro
     *   @param {Object[]} jobOptions.gcodeProcessors - The set of gcode processors to apply, in order, along with
     *     options for each.
     *     @param {String} options.gcodeProcessors.#.name - Name of gcode processor.
     *     @param {Object} options.gcodeProcessors.#.options - Additional options to pass to gcode processor constructor.
     *     @param {Number} options.gcodeProcessors.#.order - Optional order number
     *   @param {Boolean} [options.rawFile=false] - If true, pass the file unaltered to the controller, without running
     *     any gcode processors.  (Will disable status reports)
     */
    abstract startJob(_jobOptions:Readonly<JobSourceOptions>):Promise<JobStatus> 

    /**
     * Start running a job on a virtual machina. (no effective process id done)
     *
     * @method dryRunJob
     * @param {Object} jobOptions
     *   @param {String} jobOptions.filename - The input gcode file for the job.
     *   @param {Mixed} jobOptions.macro - Instead of filename, get the gcode from a generator macro
     *   @param {Object} jobOptions.macroParams - Parameters for the macro if running job from macro
     *   @param {Object[]} jobOptions.gcodeProcessors - The set of gcode processors to apply, in order, along with
     *     options for each.
     *     @param {String} options.gcodeProcessors.#.name - Name of gcode processor.
     *     @param {Object} options.gcodeProcessors.#.options - Additional options to pass to gcode processor constructor.
     *     @param {Number} options.gcodeProcessors.#.order - Optional order number
     *   @param {Boolean} [options.rawFile=false] - If true, pass the file unaltered to the controller, without running
     *     any gcode processors.  (Will disable status reports)
     * @param {String} outputFile - Optional file output for the result
     */
     abstract dryRunJob(origJobOptions: Readonly<JobSourceOptions>, outputFile?: string):Promise<JobStatus> 
}
