import EventEmitter from 'events';
import objtools from 'objtools';
import { GcodeProcessor } from './new-gcode-processor/GcodeProcessor';
/**
 * This class tracks the state of a running job or dry run.  It's mostly just a collection of properties
 * managed by JobManager.  It can also emit the events 'start', 'complete' and 'error' (also managed by JobManager).
 *
 * @class JobState
 */
export default class JobState extends EventEmitter {
    [x: string]: any;

    state:'initializing'|'complete'|'cancelled'|'error'|'running' = 'initializing';
    startTime = new Date().toISOString();
    _hasFinished = false;
    waitList = [];
    sourceStream: any;
    gcodeProcessors?:Record<string,GcodeProcessor>;

    constructor(props:Partial<JobState>) {
        super();
        // this is a list of values that the job is currently "waiting" for.  these waits are managed by gcode processors, and must be
        // added and removed by the gcode processor.  the values themselves don't mean anything.  as long as there's at least one
        // entry in this wait list, the job status is returned as "waiting"
        
        for (let key in props) {
            this[key] = props[key];
        }
        // add a handler for 'error' so the default handler (exit program) doesn't happen
        this.on('error', () => { });
    }
    emitJobStart() {
        if (this._hasFinished)
            return;
        this.emit('start');
    }
    emitJobError(err:any) {
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
    addWait(val:never) {
        this.waitList.push(val);
    }

    removeWait(val: never) {
        this.waitList = this.waitList.filter((a) => !objtools.deepEquals(a, val));
    }
}