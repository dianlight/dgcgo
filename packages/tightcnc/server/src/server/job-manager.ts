import objtools from 'objtools';
import { JobState, ERRORCODES, errRegistry, VMState } from '@dianlight/tightcnc-core';
import * as node_stream from 'stream'
import { callLineHooks, GcodeProcessor } from '@dianlight/tightcnc-core';
import { JobSourceOptions, AbstractJobManager } from '@dianlight/tightcnc-core';
import { BaseRegistryError } from 'new-error';
import { GcodeLine } from '@dianlight/tightcnc-core';
import fs from 'fs'
import { GcodeLineReadableStream, JobStatus } from '@dianlight/tightcnc-core';
import * as _ from 'lodash';

type MultipleGcodeStatus = Record<string, Partial<VMState>>;

export default class JobManager extends AbstractJobManager {


    override initialize() {
        // nop
    }

    override getStatus(job?:JobState):JobStatus|undefined {
        if (!job && this.currentJob) job = this.currentJob;
        else if (!job) return;
        else {
            // Fetch the status from each gcode processor
            const gcodeProcessorStatuses: MultipleGcodeStatus = {};
            if (job.gcodeProcessors) {
                for (const key in job.gcodeProcessors) {
                    const s = job.gcodeProcessors[key].getStatus();
                    if (s) {
                        gcodeProcessorStatuses[key] = s;
                    }
                }
            }
            // Calculate main stats and progress
            let progress = undefined;
            const stats = this._mainJobStats(gcodeProcessorStatuses);
            stats.predictedTime = stats.time;
            const finalVMStatus = gcodeProcessorStatuses ? gcodeProcessorStatuses['final-job-vm'] : undefined;
            if (finalVMStatus && finalVMStatus.updateTime && !job.dryRun) {
                const curTime = new Date(finalVMStatus.updateTime);
                stats.updateTime = curTime.toISOString();
                stats.time = (curTime.getTime() - new Date(job.startTime).getTime()) / 1000;
                // create job progress object
                if (_.has(job,'dryRunResults.stats.time')) {
                    let estTotalTime = _.get(job,'dryRunResults.stats.time') as number;
                    if ((stats.lineCount as number) >= 300) { // don't adjust based on current time unless enough lines have been processed to compensate for stream buffering
                        estTotalTime *= (curTime.getTime() - new Date(job.startTime).getTime()) / 1000 / (stats.predictedTime as number);
                    }
                    progress = {
                        timeRunning: stats.time,
                        gcodeLine: stats.gcodeLine,
                        estTotalTime: estTotalTime,
                        estTimeRemaining: Math.max(estTotalTime - (stats.time as number), 0),
                        percentComplete: Math.min((stats.time as number) / (estTotalTime || 1) * 100, 100)
                    };
                }
            }
            // Return status
            return {
                state: (job.waitList && job.waitList.length && job.state === 'running') ? 'waiting' : job.state,
                jobOptions: job.jobOptions,
                dryRunResults: job.dryRunResults,
                startTime: job.startTime,
                error: (job.state === 'error' && job.error ) ? job.error.toString() : undefined,
                gcodeProcessorsStatus: gcodeProcessorStatuses,
                stats: stats,
                progress: progress,
                waits: job.waitList
            } as JobStatus;
        }
    }

    _mainJobStats(gcodeProcessorStats: Record<string,Record<string,unknown>>):Record<string,unknown> {
        if (!gcodeProcessorStats || !gcodeProcessorStats['final-job-vm'])
            return { time: 0, line: 0, lineCount: 0 };
        return {
            time: gcodeProcessorStats['final-job-vm'].totalTime,
            line: gcodeProcessorStats['final-job-vm'].line,
            lineCount: gcodeProcessorStats['final-job-vm'].lineCounter
        };
    }
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
    async startJob(_jobOptions:Readonly<JobSourceOptions>):Promise<JobStatus> {
        this.tightcnc.debug('Begin startJob');
        // First do a dry run of the job to fetch overall stats
        const dryRunResults = await this.dryRunJob(_jobOptions);
        // Set up the gcode processors for this job
        const origJobOptions = _jobOptions;

        const jobOptions = objtools.deepCopy(_jobOptions) as JobSourceOptions;
        if (jobOptions.filename)
            jobOptions.filename = this.tightcnc.getFilename(jobOptions.filename, 'data', true);
        if (jobOptions.rawFile) {
            delete jobOptions.gcodeProcessors;
        } else {
            // add default gcode vm processor to enable basic status updates automatically
            if (!jobOptions.gcodeProcessors)
                jobOptions.gcodeProcessors = [];
            jobOptions.gcodeProcessors.push({
                name: 'gcodevm',
                options: {
                    id: 'final-job-vm',
                    updateOnHook: 'executed'
                },
                order: 1000000
            });
        }
        // Check to ensure current job isn't running and that the controller is ready
        if (this.currentJob && this.currentJob.state !== 'complete' && this.currentJob.state !== 'cancelled' && this.currentJob.state !== 'error') {
            throw errRegistry.newError('INTERNAL_SERVER_ERROR','GENERIC').formatMessage('Cannot start job with another job running.');
        }
        if (!this.tightcnc.controller?.ready) {
            throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Controller not ready.');
        }
        // Create the current job object
        this.currentJob = new JobState({
            state: 'initializing',
            jobOptions: origJobOptions,
            dryRunResults: dryRunResults,
            startTime: new Date().toISOString()
        });
        const job = this.currentJob;
        // Clear the message log
        this.tightcnc.messageLog?.clear();
        this.tightcnc.messageLog?.log('Job started.');
        // Wait for the controller to stop moving
        this.tightcnc.debug('startJob waitSync');
        await this.tightcnc.controller?.waitSync();
        // Note that if the following few lines have any await's in between them, it could result
        // in certain errors from gcode processors breaking things, since errors are handled through
        // Controller#sendStream().
        // Build the processor chain
        this.tightcnc.debug('startJob getGcodeSourceStream');
        const source = this.tightcnc.getGcodeSourceStream({
            filename: jobOptions.filename,
            macro: jobOptions.macro,
            macroParams: jobOptions.macroParams,
            gcodeProcessors: jobOptions.gcodeProcessors,
            rawStrings: jobOptions.rawFile || false,
            job: job
        });
        job.sourceStream = source;
        job.emitJobStart();
        // Pipe it to the controller, asynchronously
        this.tightcnc.debug('startJob pipe stream');
        this.tightcnc.controller?.sendStream(source)
            .then(() => {
            job.state = 'complete';
            job.emitJobComplete();
            this.tightcnc.debug('Job Completed');
        })
            .catch((err: BaseRegistryError) => {
            if (err.getSubCode() === ERRORCODES.CANCELLED.subCode) {
                job.state = 'cancelled';
            }
            else {
                job.state = 'error';
                job.error = JSON.stringify(err.toJSON());
                console.error(`Job error: ${JSON.stringify(err)}`);
                console.error(err.stack);
            }
            job.emitJobError(err);
        });
        // Wait until the processorChainReady event (or chainerror event) fires on source (indicating any preprocessing is done)
        this.tightcnc.debug('startJob wait for processorChainReady');
        await new Promise<void>((resolve, reject) => {
            let finished = false;
            source.on('processorChainReady', (_chain:GcodeProcessor[]) => {
                if (finished)
                    return;
                finished = true;
                job.gcodeProcessors = _chain.reduce((prev:Record<string,GcodeProcessor>, next) => { prev[next.id] = next; return prev; }, {} as Record<string,GcodeProcessor>);
                job.startTime = new Date().toISOString();
                resolve();
            });
            source.on('chainerror', (err:unknown) => {
                if (finished)
                    return;
                finished = true;
                job.state = 'error';
                job.error = JSON.stringify(err);
                reject(err);
            });
        });
        job.state = 'running';
        this.tightcnc.debug('End startJob');
        return this.getStatus(job) as JobStatus;
    }

    async dryRunJob(origJobOptions: Readonly<JobSourceOptions>, outputFile?: string):Promise<JobStatus> {
        this.tightcnc.debug('Begin dryRunJob');
        const _jobOptions = objtools.deepCopy(origJobOptions) as JobSourceOptions;
        if (_jobOptions.filename)
            _jobOptions.filename = this.tightcnc.getFilename(_jobOptions.filename, 'data', true);
        if (outputFile)
            outputFile = this.tightcnc.getFilename(outputFile, 'data', true);
        if (_jobOptions.rawFile) {
            delete _jobOptions.gcodeProcessors;
        } else {
            // add default gcode vm processor to enable basic status updates automatically
            if (!_jobOptions.gcodeProcessors)
                _jobOptions.gcodeProcessors = [];
            _jobOptions.gcodeProcessors.push({
                name: 'gcodevm',
                options: {
                    id: 'final-job-vm'
                },
                order: 1000000
            });
        }
        const job = new JobState({
            state: 'initializing',
            jobOptions: origJobOptions,
            startTime: new Date().toISOString(),
            dryRun: true
        });
        // Do dry run to get overall stats
        this.tightcnc.debug('Dry run getGcodeSourceStream');
        let source = this.tightcnc.getGcodeSourceStream({
            filename: _jobOptions.filename,
            macro: _jobOptions.macro,
            macroParams: _jobOptions.macroParams,
            gcodeProcessors: _jobOptions.gcodeProcessors,
            rawStrings: _jobOptions.rawFile || false,
            dryRun: true,
            job: job
        });
        const origSource = source;
        source = new GcodeLineReadableStream({
            gcodeLineTransform: (gline: GcodeLine, callback) => {
                callLineHooks(gline)
                callback(undefined,gline)
            }
        }).wrap(origSource)

        job.sourceStream = source;
        job.state = 'running';
        return new Promise((resolve, reject) => {
            origSource.on('processorChainReady', (_chain:GcodeProcessor[]) => {
                //console.log("Dry Run Chain Processors:",_chain)
                job.gcodeProcessors = _chain.reduce((prev:Record<string,GcodeProcessor>, next) => { prev[next.id] = next; return prev; }, {} as Record<string,GcodeProcessor>);
                this.tightcnc.debug('Dry run stream');
                if (outputFile) {
                    source.pipe(new node_stream.Transform({
                        transform: (chunk, encoding, cb) => {
                            if (chunk instanceof GcodeLine) cb(undefined, chunk.toString()+'\n')
                            else cb(undefined,chunk)
                        },
                        objectMode: true
                    }))
                    .pipe(fs.createWriteStream(outputFile))
                } 
                (async function () {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    for await (const chunk of source) {
                        // console.log(chunk);
                    }
                })()
                    .then(() => {
                        job.state = 'complete';
                        // Get the job stats
                        this.tightcnc.debug('Dry run get stats');
                        const ret = this.getStatus(job);
                        this.tightcnc.debug('End dryRunJob');
                        if(!ret)reject(errRegistry.newError('INTERNAL_SERVER_ERROR','GENERIC').formatMessage('DryRun produce no status!'))
                        else resolve(ret);                                         
                    })
                    .catch((err) => {
                        console.error(typeof err, err)
                        this.tightcnc.debug('Dry run got error');
                        job.state = 'error'
                        job.emitJobError(err)
                        reject(err)                    
                    })
                
            });
        })
    }
}
