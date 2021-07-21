import objtools from 'objtools';
//import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import EventEmitter from 'events';
import { JobStatus } from './job-status';
import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import { VMState } from './gcode-processor/VMState';
/**
 * This class tracks the state of a running job or dry run.  It's mostly just a collection of properties
 * managed by JobManager.  It can also emit the events 'start', 'complete' and 'error' (also managed by JobManager).
 *
 * @class JobState
 */
export class JobState extends EventEmitter implements JobStatus {
    [x: string]: unknown;

    state:'initializing'|'complete'|'cancelled'|'error'|'running' = 'initializing';
    startTime = new Date().toISOString();
    _hasFinished = false;
    waitList:string[] = [];
    //sourceStream: any;
    gcodeProcessors?: Record<string, GcodeProcessor>;
    dryRunResults?: Partial<JobStatus>
    error?: string | undefined

    constructor(props:Partial<JobState>) {
        super();
        // this is a list of values that the job is currently "waiting" for.  these waits are managed by gcode processors, and must be
        // added and removed by the gcode processor.  the values themselves don't mean anything.  as long as there's at least one
        // entry in this wait list, the job status is returned as "waiting"
        
        for (const key in props) {
            this[key] = props[key];
        }
        // add a handler for 'error' so the default handler (exit program) doesn't happen
        //this.on('error', () => {});
    }

    jobOptions?: Record<string, unknown>;
    gcodeProcessorsStatus?: Record<string, Partial<VMState>>;
    stats?: Record<string, unknown>;
    progress?: { gcodeLine: number; timeRunning: unknown; estTotalTime: unknown; estTimeRemaining: number; percentComplete: number; };
    waits?: string[];

    emitJobStart() {
        if (this._hasFinished)
            return;
        this.emit('start');
    }
    emitJobError(err:unknown) {
        if (this._hasFinished)
            return;
        this._hasFinished = true;
        this.emit('error', err);
    }
    emitJobComplete() {
        if (this._hasFinished)
            return;
        this._hasFinished = true;
        this.emit('complete');
    }
    addWait(val:string) {
        this.waitList.push(val);
    }

    removeWait(val: string) {
        this.waitList = this.waitList.filter((a) => !objtools.deepEquals(a, val));
    }
}