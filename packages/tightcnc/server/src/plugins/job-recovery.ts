/*
 * This plugin contains facilities for recovering from jobs that are interrupted in the middle.  The general strategy
 * here is track how much of the job has executed (as both line count and predicted time, to enable seeking on both)
 * and periodically save it out to a file.  To recover, a gcode processor skips all lines up to that point (or a little
 * before to account for uncertainties in actual execution times), then starts the job from there.  Additionally,
 * some machine state (spindle, coolant, etc) is tracked with a vm for all prior lines, and the machine is set to that
 * state information prior to resuming.  The maximum G4 pause is also tracked and is sent before resuming to ensure the
 * spindle has time to spin up.
 *
 * Before starting recovery, the spindle is moved into a clearance position, then into a position above the first move
 * in the recovery, before being lowered into position to start the recovery.  There are various configuration options
 * for these clearance movements, including the ability to use different axes.  The default assumes a typical x, y, z
 * axis configuration with clearance on Z at machine position 0 (ie, G53 G0 Z0).
 */
import { errRegistry } from '../server/errRegistry';
import { GcodeProcessor } from '../server/new-gcode-processor/GcodeProcessor';
import GcodeLine from '../server/new-gcode-processor/GcodeLine';
import GcodeVM from '../server/new-gcode-processor/GcodeVM';
import Operation from '../server/operation';
import objtools from 'objtools';
import pasync from 'pasync';
import fs from 'fs';
//import ListForm from '../consoleui/list-form';
import { JSONSchema7 } from 'json-schema';
import TightCNCServer from '../server/tightcnc-server';
const getRecoveryFilename = (tightcnc: any) => {
    return tightcnc.getFilename('_recovery.json', 'data');
};
// @ts-expect-error ts-migrate(2393) FIXME: Duplicate function implementation.
function findCurrentJobGcodeProcessor(tightcnc, name, throwOnMissing = true) {
    let currentJob = tightcnc.jobManager.currentJob;
    if (!currentJob || currentJob.state === 'cancelled' || currentJob.state === 'error' || currentJob.state === 'complete') {
        throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('No currently running job');
    }
    let gcodeProcessors = currentJob.gcodeProcessors || {};
    for (let key in gcodeProcessors) {
        if (gcodeProcessors[key].gcodeProcessorName === name) {
            return gcodeProcessors[key];
        }
    }
    if (throwOnMissing) {
        throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('No ' + name + ' gcode processor found');
    }
    else {
        return null;
    }
}
/**
 * This gcode processor is added to a job to periodically save out job state and enable recovery.  It should be
 * positioned in the processor chain at the end of the chain, with the exception of being before a JobRecoveryProcessor
 * if an existing recovery is in progress.
 *
 * @class JobRecoveryTracker
 */
class JobRecoveryTracker extends GcodeProcessor {
    static DEFAULT_ORDER = 400000;
    constructor(options = {}) {
        super(options, 'recoverytracker', true);
        (this as any).vm = new GcodeVM(options);
        (this as any).recoverySaveInterval = (options as any).recoverySaveInterval || 10;
        (this as any).hasEnded = false;
        (this as any).saveData = {
            jobOptions: (this as any).job && (this as any).job.jobOptions,
            lineCountOffset: 0,
            predictedTimeOffset: 0
        };
    }
    override async initProcessor() {
        if ((this as any).dryRun)
            return;
        const saveLoop = async () => {
            while (!(this as any).hasEnded) {
                await pasync.setTimeout((this as any).recoverySaveInterval * 1000);
                if ((this as any).hasEnded)
                    break;
                try {
                    let rproc = findCurrentJobGcodeProcessor((this as any).tightcnc, 'recoveryprocessor');
                    if (!rproc.startedPassThrough)
                        return; // don't save state before recovery processor starts forwarding through data
                }
                catch (err) { }
                let data = JSON.stringify((this as any).saveData) + '\n';
                await new Promise<void>((resolve, reject) => {
                    fs.writeFile(getRecoveryFilename((this as any).tightcnc), data, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
            }
        };
        (this as any).job.on('complete', () => {
            (this as any).hasEnded = true;
            fs.unlink(getRecoveryFilename((this as any).tightcnc), () => { });
        });
        (this as any).on('end', () => {
            (this as any).hasEnded = true;
        });
        (this as any).on('chainerror', () => {
            (this as any).hasEnded = true;
        });
        saveLoop();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'gline' implicitly has an 'any' type.
    processGcode(gline) {
        if ((this as any).dryRun)
            return gline; // don't save recovery state during dry runs
        (this as any).vm.runGcodeLine(gline);
        let vmState = (this as any).vm.getState();
        let lineCounter = vmState.lineCounter;
        let totalTime = vmState.totalTime;
        gline.hookSync('executed', () => {
            (this as any).saveData.jobOptions = (this as any).job && (this as any).job.jobOptions;
            (this as any).saveData.lineCountOffset = lineCounter;
            (this as any).saveData.predictedTimeOffset = totalTime;
        });
        return gline;
    }
}
/**
 * This gcode processor is used to recovery a job that was interrupted before it could be completed.  It loads the
 * recovery file, then skips past all gcode lines in the job up until the recovery point is reached.  Once the recovery
 * point is reached the machine moves into a clearance position above the recovery point, machine state (eg. spindle state)
 * is synchronized to what it would have been at that point in the job, and a dwell is executed to allow the spindle
 * to spin up.  Then further gcode lines in the job are passed through unaltered.
 *
 * @class JobRecoveryProcessor
 * @constructor
 * @param {Object} options - Gcode processor options.  There are some recovery-specific ones listed here.  All of the
 *   recovery-specific options have defaults defined in the config in the recovery section.
 *   @param {Number} options.backUpTime - Once the recovery point in the job has been reached, additionally "rewind"
 *     this number of seconds.
 *   @param {Number} options.backUpLines - In addition to backing up the backUpTime number of seconds, also back up
 *     this number of gcode lines.  This is useful in cases that the 'executed' hook on gcode lines is not entirely
 *     deterministic, so this adds an additional buffer for safety.
 *   @param {String[]} options.moveToClearance - An array of gcode strings to execute to move the machine into a clearance
 *     position above the recovery position.  The values {x}, {y}, etc. are substituted in the strings for the
 *     coordinates of the job recovery position.
 *   @param {String[]} options.moveToWorkpiece - An array of gcode strings to execute to move the machine from the
 *     clearance position to the position to start recovery.
 */
class JobRecoveryProcessor extends GcodeProcessor {
    static DEFAULT_ORDER = 500000;
    constructor(options = {}) {
        super(options, 'recoveryprocessor', true);
        (this as any).vm = new GcodeVM(options);
        (this as any).recoveryConfig = (this as any).tightcnc.config.recovery;
        (this as any).recoveryParams = {
            backUpLines: typeof (options as any).backUpLines === 'number' ? (options as any).backUpLines : (this as any).recoveryConfig.backUpLines,
            backUpTime: typeof (options as any).backUpTime === 'number' ? (options as any).backUpTime : (this as any).recoveryConfig.backUpTime
        };
        (this as any).clearanceParams = {
            moveToClearance: (options as any).moveToClearance || (this as any).recoveryConfig.moveToClearance,
            moveToWorkpiece: (options as any).moveToWorkpiece || (this as any).recoveryConfig.moveToWorkpiece
        };
        (this as any).maxDwell = 0;
        // If true, we've passed the point of skipping lines and are now passing everything through.
        (this as any).startedPassThrough = false;
        // A rotating buffer of backUpLines glines, so we can back up that number of lines after the resume condition is met.
        (this as any).recoveryLineBuffer = [];
    }
    override async initProcessor() {
        // Load recovery file
        (this as any).recoveryInfo = await new Promise((resolve, reject) => {
            fs.readFile(getRecoveryFilename((this as any).tightcnc), { encoding: 'utf8' }, (err, str) => {
                if (err)
                    return reject(err);
                try {
                    let j = JSON.parse(str);
                    resolve(j);
                }
                catch (err2) {
                    reject(err2);
                }
            });
        });
    }
    //override async copyProcessor() {
    //    return super.copyProcessor();
    //}
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'vmState' implicitly has an 'any' type.
    syncMachineToVMState(vmState) {
        let lines = (this as any).vm.syncMachineToState({
            vmState: vmState,
            include: ['motionMode', 'feed', 'arcPlane', 'incremental', 'inverseFeed', 'units', 'spindle', 'coolant', 'tool']
        });
        for (let line of lines) {
            this.pushGcode(line);
        }
    }
    // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
    async clearanceMoves(macro, params) {
        await (this as any).tightcnc.runMacro(macro, params, { gcodeProcessor: this, waitSync: true });
    }
    async beginRecovery() {
        let preRecoveryVMState = (this as any).recoveryLineBuffer[0].vmStateBefore;
        let moveParams = {};
        for (let axisNum = 0; axisNum < preRecoveryVMState.pos.length; axisNum++) {
            if (preRecoveryVMState.axisLabels[axisNum]) {
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                moveParams[preRecoveryVMState.axisLabels[axisNum]] = preRecoveryVMState.pos[axisNum];
            }
        }
        // Move to clearance position, "above" workpiece
        await this.clearanceMoves((this as any).clearanceParams.moveToClearance, { pos: preRecoveryVMState.pos });
        // Synchronize machine to pre recovery VM state
        this.syncMachineToVMState(preRecoveryVMState);
        // Run dwell
        if ((this as any).maxDwell) {
            this.pushGcode(new GcodeLine('G4 P' + (this as any).maxDwell));
        }
        // Move to starting position
        await this.clearanceMoves((this as any).clearanceParams.moveToWorkpiece, { pos: preRecoveryVMState.pos });
        // Push all the lines in the rotating buffer
        while ((this as any).recoveryLineBuffer.length) {
            let { gline } = (this as any).recoveryLineBuffer.shift();
            this.pushGcode(gline);
        }
        (this as any).startedPassThrough = true;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'gline' implicitly has an 'any' type.
    async processGcode(gline) {
        if ((this as any).startedPassThrough)
            return gline;
        let vmStateBefore = objtools.deepCopy((this as any).vm.getState());
        (this as any).vm.runGcodeLine(gline);
        let vmState = (this as any).vm.getState();
        if (gline.has('G4') && gline.has('P') && gline.get('P') > (this as any).maxDwell) {
            (this as any).maxDwell = gline.get('P');
        }
        // rotate the line buffer
        if ((this as any).recoveryParams.backUpLines > 0) {
            (this as any).recoveryLineBuffer.push({
                gline,
                vmStateAfter: objtools.deepCopy(vmState),
                vmStateBefore
            });
            if ((this as any).recoveryLineBuffer.length > (this as any).recoveryParams.backUpLines) {
                (this as any).recoveryLineBuffer.shift();
            }
        }
        // check if this meets the time resume condition
        if (vmState.totalTime >= (this as any).recoveryInfo.predictedTimeOffset) {
            if (!(this as any).recoveryLineBuffer.length) {
                (this as any).recoveryLineBuffer.push({
                    gline,
                    vmStateAfter: objtools.deepCopy(vmState),
                    vmStateBefore: vmStateBefore
                });
            }
            await this.beginRecovery();
        }
        else {
            // Blackhole the gline by calling all the hooks on it
            gline.triggerSync('queued');
            gline.triggerSync('sent');
            gline.triggerSync('ack');
            gline.triggerSync('executing');
            gline.triggerSync('executed');
        }
        return undefined;
    }
}
/**
 * This operation attempts to recover the most recent interrupted job.
 *
 * @class JobRecoveryOperation
 */
class JobRecoveryOperation extends Operation {
    getParamSchema() {
        return {
            backUpTime: {
                type: 'number',
                description: 'Number of seconds to rewind before restarting the job'
            }
        } as JSONSchema7;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'params' implicitly has an 'any' type.
    async run(params) {
        // Load the recovery file (to get the original job options)
        let recoveryInfo = await new Promise((resolve, reject) => {
            fs.readFile(getRecoveryFilename((this as any).tightcnc), { encoding: 'utf8' }, (err, str) => {
                if (err)
                    return reject(errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Could not read job recovery file').withMetadata(err));
                try {
                    let j = JSON.parse(str);
                    resolve(j);
                }
                catch (err2) {
                    reject(err2);
                }
            });
        });
        // Manipulate the gcode processors
        let jobOptions = (recoveryInfo as any).jobOptions;
        if (!jobOptions.gcodeProcessors)
            jobOptions.gcodeProcessors = [];
        // Remove any existing recovery processors in the gcode processor chain
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'gp' implicitly has an 'any' type.
        jobOptions.gcodeProcessors = jobOptions.gcodeProcessors.filter((gp) => gp.name !== 'recoveryprocessor');
        // Add the recovery processor to the chain immediately after the recovery tracker
        let newprocessor = {
            name: 'recoveryprocessor',
            options: {
                backUpTime: params.backUpTime
            },
            order: 500000
        };
        let foundRecoveryTracker = false;
        for (let i = 0; i < jobOptions.gcodeProcessors.length; i++) {
            if (jobOptions.gcodeProcessors[i].name === 'recoverytracker') {
                foundRecoveryTracker = true;
                jobOptions.gcodeProcessors.splice(i + 1, 0, newprocessor);
                break;
            }
        }
        if (!foundRecoveryTracker)
            jobOptions.gcodeProcessors.push(newprocessor);
        // Start the recovery job
        return await (this as any).tightcnc.jobManager.startJob(jobOptions);
    }
}
/*
 * This handles recovering a job in the console ui.  It's registered to run on a keypress from the home
 * screen, and just displays a few dialogs before starting the recovery operation.
 */
/*
function consoleUIRecoverJob(consoleui) {
    async function doRecover() {
        // Ask how much time to back up
        let form = new ListForm(consoleui);
        let recoverySettings = await form.showEditor(null, {
            type: 'object',
            label: 'Job Recovery Settings',
            doneLabel: '[Start Recovery]',
            properties: {
                backUpTime: {
                    type: 'number',
                    label: 'Rewind Time (s)',
                    default: 5,
                    required: true
                }
            }
        },{});
        // Show confirmation
        let text = 'Job recovery is about to start.  Please ensure that your recovery settings are correct, particularly with regard to clearance movements and positions.  Also ensure that the device\'s coordinate system is set up to match the original job\'s.  Press ENTER to begin or Esc to cancel.';
        let confirmed = await consoleui.showConfirm(text, { okLabel: 'Start' });
        if (!confirmed)
            return;
        // Start job
        await consoleui.runWithWait(async () => {
            await consoleui.client.op('recoverJob', recoverySettings);
        }, 'Initializing ...');
        consoleui.showTempMessage('Starting job.');
        // Go to job info mode
        consoleui.activateMode('jobInfo');
    }
    doRecover()
        .catch((err) => {
        consoleui.clientError(err);
    });
}
*/
//module.exports.JobRecoveryTracker = JobRecoveryTracker;
//module.exports.JobRecoveryProcessor = JobRecoveryProcessor;
//module.exports.JobRecoveryOperation = JobRecoveryOperation;

export function registerServerComponents(tightcnc:TightCNCServer) {
    tightcnc.registerGcodeProcessor(/*'recoverytracker',*/ JobRecoveryTracker);
    tightcnc.registerGcodeProcessor(/*'recoveryprocessor',*/ JobRecoveryProcessor);
    tightcnc.registerOperation(/*'recoverJob',*/ JobRecoveryOperation);
};

/*
export function registerConsoleUIComponents(consoleui) {
    // Automatically add recovery tracker to all jobs created in the console UI
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'jobOptions' implicitly has an 'any' typ... Remove this comment to see the full error message
    consoleui.on('newJobObject', (jobOptions) => {
        if (!jobOptions.gcodeProcessors)
            jobOptions.gcodeProcessors = [];
        jobOptions.gcodeProcessors.push({
            name: 'recoverytracker',
            options: {},
            order: 400000
        });
    });
    // Add a key to recover a job to the home screen
    consoleui.registerHomeKey(['r', 'R'], 'r', 'Recover Job', () => consoleUIRecoverJob(consoleui));
};
*/
