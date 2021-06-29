//import XError from 'xerror';
import { errRegistry } from '../server/errRegistry';
import { GcodeProcessor } from '../server/new-gcode-processor/GcodeProcessor';
import GcodeLine from '../server/new-gcode-processor/GcodeLine';
import GcodeVM from '../server/new-gcode-processor/GcodeVM';
import objtools from 'objtools';
import pasync from 'pasync';
import Operation from '../server/operation';
//import ListForm from '../consoleui/list-form';
import commonSchema from 'common-schema';
import { JSONSchema7 } from 'json-schema';
import TightCNCServer from '../server/tightcnc-server';
/**
 * This gcode processors allows overriding things at job runtime.  Currently just supports feed multiplier.
 *
 * To ensure override changes take effect quickly, this processor limits the total number of lines buffered
 * and not yet executed downstream of this processor to a set minimum.  Because of this, this processor should
 * probably occur near the end of a processor chain.  It should also probably occur after the job recovery processors
 * so it doesn't interfere with that.
 *
 * @class RuntimeOverride
 * @constructor
 * @param {Object} options
 *   @param {Number} [maxTotalLinesBuffered=40] - Maximum number of buffered not-executed lines downstream
 */
class RuntimeOverride extends GcodeProcessor {

    static DEFAULT_ORDER = 950000;

    maxTotalLinesBuffered:number;
    feedMultiplier = 1;
    vm:any
    lastLineCounterExecuted = 0;
    nextExecutedWaiter?:any;


    constructor(options = {}) {
        super(options, 'runtimeoverride', true);
        this.maxTotalLinesBuffered = (options as any).maxTotalLinesBuffered || 40;
        this.vm = new GcodeVM(options);
    }
    override getStatus() {
        return {
            feedMultiplier: this.feedMultiplier
        };
    }

    override async processGcode(gline:GcodeLine) {
        if (this.dryRun)
            return gline;
        this.vm.runGcodeLine(gline);
        let lineCounter = this.vm.lineCounter;
        if (lineCounter - this.lastLineCounterExecuted - 1 >= this.maxTotalLinesBuffered) {
            if (!this.nextExecutedWaiter)
                this.nextExecutedWaiter = pasync.waiter();
            await this.nextExecutedWaiter.promise;
        }
        if (this.feedMultiplier !== 1 && gline.has('F')) {
            gline.set('F', gline.get('F') as number * this.feedMultiplier);
            gline.addComment('ro');
        }
        gline.hookSync('executed', () => {
            if (lineCounter > this.lastLineCounterExecuted) {
                this.lastLineCounterExecuted = lineCounter;
            }
            if (this.nextExecutedWaiter && lineCounter - this.lastLineCounterExecuted - 1 < this.maxTotalLinesBuffered) {
                this.nextExecutedWaiter.resolve();
                this.nextExecutedWaiter = null;
            }
        });
        return gline;
    }
    setFeedMultiplier(m:number) {
        this.feedMultiplier = m;
        if (this.vm.getState().seenWordSet.F) {
            this.pushGcode(new GcodeLine('F' + (this.vm.getState().feed * m)));
        }
    }
}
class SetFeedMultiplierOperation extends Operation {
    getParamSchema() {
        return {
            feedMultiplier: {
                type: Number,
                required: true,
                default: 1,
                description: 'Multiplier for job feed rates'
            }
        } as JSONSchema7;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'params' implicitly has an 'any' type.
    async run(params) {
        findCurrentJobGcodeProcessor(this.tightcnc, 'runtimeoverride').setFeedMultiplier(params.feedMultiplier);
        return { success: true };
    }
}
// @ts-expect-error ts-migrate(7006) FIXME: Parameter 'tightcnc' implicitly has an 'any' type.
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
module.exports.RuntimeOverride = RuntimeOverride;
module.exports.SetFeedMultiplierOperation = SetFeedMultiplierOperation;

module.exports.registerServerComponents = function (tightcnc:TightCNCServer) {
    tightcnc.registerGcodeProcessor(/*'runtimeoverride',*/ RuntimeOverride);
    tightcnc.registerOperation(/*'setFeedMultiplier',*/ SetFeedMultiplierOperation);
};
/*
// @ts-expect-error ts-migrate(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports.registerConsoleUIComponents = function (consoleui) {
    // Automatically add to all jobs created in the console UI
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'jobOptions' implicitly has an 'any' typ... Remove this comment to see the full error message
    consoleui.on('newJobObject', (jobOptions) => {
        if (!jobOptions.gcodeProcessors)
            jobOptions.gcodeProcessors = [];
        jobOptions.gcodeProcessors.push({
            name: 'runtimeoverride',
            options: {},
            order: 950000
        });
    });
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'textobj' implicitly has an 'any' type.
    consoleui.modes.jobInfo.hookSync('buildStatusText', (textobj) => {
        let status = consoleui.lastStatus;
        let feedMultiplier = objtools.getPath(status, 'job.gcodeProcessors.runtimeoverride.feedMultiplier');
        if (feedMultiplier && feedMultiplier !== 1) {
            textobj.text += 'Feed multiplier: ' + feedMultiplier + '\n';
        }
    });
    const doFeedOverride = async () => {
        let form = new ListForm(consoleui);
        let mult = await form.showEditor(null, {
            type: 'number',
            required: true,
            label: 'Feed Multiplier',
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'v' implicitly has an 'any' type.
            validate: (v) => {
                if (!v || v < 0)
                    throw new commonSchema.FieldError('invalid', 'Feed multiplier must be a positive number');
            }
        }, objtools.getPath(consoleui, 'lastStatus.job.gcodeProcessors.runtimeoverride.feedMultiplier') || 1);
        if (mult /*&& !form.editorCancelled* /) {
            await consoleui.client.op('setFeedMultiplier', { feedMultiplier: mult });
        }
    };
    consoleui.modes.jobInfo.registerModeKey(['f'], ['f'], 'Feed Mult.', () => {
        doFeedOverride().catch((err) => consoleui.clientError(err));
    });
};
*/
