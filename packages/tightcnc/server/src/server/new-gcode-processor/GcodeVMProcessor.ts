import { GcodeProcessor, GcodeProcessorLifeCycle, GcodeProcessorOptions } from '@dianlight/tightcnc-core';
import objtools from 'objtools';
import  {Controller, GcodeVM ,VMState,GcodeLine } from '@dianlight/tightcnc-core';
import { JSONSchema7 } from 'json-schema';

interface GcodeVMProcessorOptions extends GcodeProcessorOptions{
    noInit: boolean,
    controller: Controller, // - The machine controller class instance for the gcode to run on.  Used to fetch initial state.
    axisLabels: string[], // - Override default axis labels.  Defaults come from the controller, or are [ 'x', 'y', 'z' ].
    maxFeed: number, // - Maximum feed rate, used to calculate time for G0 moves.
    minMoveTime: number, // - Minimum time to count for a move.  Can be set to a low value to compensate for delays if lots  of small moves aren't filling the controller's buffer.
    updateOnHook: string, // - If a string hook name (for example, "executed"), the VM state is only updated once this hook is called on the gcode line.  This option cannot be used with stateSnapshots.
    stateSnapshots: boolean //  - If true (and not using updateOnHook), gcode lines passing through are augmented with the properties before (vm state before line), after (vm state after line), and isMotion (whether the line represents motion).   
}

/**
 * This gcode processor is a virtual machine that tracks the state of a gcode job as it executes, and annotates all gcode lines
 * with the state of the virtual machine before and after the gcode line executes.  This is necessary to find the actual positions
 * of the machine during a job.
 *
 * This virtual machine is primarily intended for analysis of jobs that are mostly machine movement, but also includes support
 * for some command codes.  Note that it is note a validator, and may not represent actual machine behavior with invalid gcode.
 *
 * Gcode lines passing through the stream are annotated with the following properties:
 * - before - The virtual machine state prior to the line being executed.
 * - after - The virtual machine state after the line is executed.
 * - isMotion - A boolean flag indicating whether the gcode line is a movement command.
 * Additionally, the virtual machine state object is available on the GcodeVM under the `vmState` property.
 *
 * Virtual machine state contains a number of properties.  The most useful are probably the following:
 * - axisLabels - An array of (lowercase) letters for each of the axes.  The indexes into this array correspond to the indexes
 *   into the various position values.
 * - pos - Current position in active coordinate system.  This is an array of numbers, with indexes corresponding to axes.
 * - spindle - Whether the spindle is on or off.
 * - line - Last gcode line number processed.
 * - totalTime - Estimated total time in second for the job up to the current point, in seconds.
 * - bounds - The bounding box for all coordinates present in moves.  [ LowPosition, HighPosition ]
 * - coord(pos, axis) - A utility function to fetch the coordinate of the given position at the given axis.  The axis can
 *   be specified either by number or letter.
 *
 * @class GcodeVMProcessor
 * @constructor
 * @param {Object} [options]
 *   @param {Controller} controller - The machine controller class instance for the gcode to run on.  Used to fetch initial state.
 *   @param {TightCNCServer} tightcnc - Server instance.  Can also be provided to get some initial state.
 *   @param {String[]} axisLabels - Override default axis labels.  Defaults come from the controller, or are [ 'x', 'y', 'z' ].
 *   @param {Number} maxFeed - Maximum feed rate, used to calculate time for G0 moves.
 *   @param {Number} minMoveTime - Minimum time to count for a move.  Can be set to a low value to compensate for delays if lots
 *     of small moves aren't filling the controller's buffer.
 *   @param {String} updateOnHook - If a string hook name (for example, "executed"), the VM state is only updated once this hook
 *     is called on the gcode line.  This option cannot be used with stateSnapshots.
 *   @param {Boolean} stateSnapshots=false - If true (and not using updateOnHook), gcode lines passing through are augmented with
 *     the properties before (vm state before line), after (vm state after line), and isMotion (whether the line represents motion).
 */
export default class GcodeVMProcessor extends GcodeProcessor {
    preprocessInputGcode(this: void): void | ReadableStream<any> {
        // No action.
    }
    flushGcode(): void | GcodeLine | GcodeLine[] | Promise<GcodeLine | GcodeLine[]> {
        // No action.
    }

    vm: GcodeVM
    _statusVMState?: VMState
    lastLineProcessedTime?: Date 

    constructor(options:GcodeVMProcessorOptions) {
        super(options, 'gcodevm', false);
        const vmOptions = objtools.deepCopy(options) as GcodeVMProcessorOptions;
        vmOptions.noInit = true;
        this.vm = new GcodeVM(vmOptions);
        this.vm.init();
        if (this.processorOptions.updateOnHook) {
            this._statusVMState = objtools.deepCopy(this.vm.getState()) as VMState;
        }
    }

    override async initProcessor() {
        this.vm.init();
        return Promise.resolve();
    }

    /**
     * Thi method return json-schema definition of the custom options for the controller
     */
    static override getOptionSchema(): JSONSchema7 {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            $id: '/gcodevm',
        } as JSONSchema7
    }

    static override getLifeCicle(): GcodeProcessorLifeCycle {
        return 'internal'
    }



    override getStatus():Partial<VMState>|void {
        // return a reduced set of state information for the general status data; this is just used for
        // returning job data to clients - gline.before and gline.after still contain the full vmstate for internal use
        let vmState;
        if (this.processorOptions.updateOnHook) {
            vmState = this._statusVMState;
        } else {
            vmState = this.vm.getState();
        }
        if (!vmState) return;
        return {
            units: vmState.units,
            line: vmState.line,
            totalTime: vmState.totalTime,
            lineCounter: vmState.lineCounter,
            bounds: vmState.bounds,
            updateTime: this.lastLineProcessedTime?this.lastLineProcessedTime.toISOString():undefined
        };
    }

    override processGcode(gline: GcodeLine) {
        this.lastLineProcessedTime = new Date();
        if (this.processorOptions.updateOnHook && !this.dryRun) {
            const r = this.vm.runGcodeLine(gline);
            gline.isMotion = r.isMotion;
            const vmStateAfter = objtools.deepCopy(this.vm.getState()) as VMState;
            //console.log(typeof gline,gline)
            gline.hookSync(this.processorOptions.updateOnHook, () => {
                this.lastLineProcessedTime = new Date();
                // in case hooks are called out of order, don't update state with an out of date value
                if (this._statusVMState && this._statusVMState.lineCounter >= vmStateAfter.lineCounter) return;
                this._statusVMState = vmStateAfter;
            });
        } else if (this.processorOptions.stateSnapshots) {
            this.lastLineProcessedTime = new Date();
            const beforeState = objtools.deepCopy(this.vm.getState()) as VMState;
            const r = this.vm.runGcodeLine(gline);
            // Augment line with state info, and return it
            gline.before = beforeState;
            gline.after = objtools.deepCopy(this.vm.getState()) as VMState;
            gline.isMotion = r.isMotion;
        } else {
            this.lastLineProcessedTime = new Date();
            let r = this.vm.runGcodeLine(gline);
            gline.isMotion = r.isMotion;
        }
        return gline;
    }

}
