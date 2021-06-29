import { errRegistry } from '../errRegistry'
import GcodeLine from './GcodeLine';
import objtools from 'objtools' 
import Controller from '../controller';
import TightCNCServer from '../tightcnc-server';


export interface GcodeVMOptions {
    controller?: Controller,
    tightcnc?: TightCNCServer,
    axisLabels?: string[],
    maxFeed?: number | number[],
    acceleration?: number | number[],
    minMoveTime?: number
    noInit?: boolean,
    [key:string]:any
}

export interface VMState {
    axisLabels: string[]
    coord?:(coords:number[], axis:number|string, value?:number) => number|undefined // = this.coord.bind(this);
    totalTime:number; // seconds
    bounds?:[(number|null)[],(number|null)[]] // = [this.zerocoord(null), this.zerocoord(null)]; // min and max points
    mbounds?:[(number|null)[],(number|null)[]]// = [this.zerocoord(null), this.zerocoord(null)]; // bounds for machine coordinates
    lineCounter:number;
    hasMovedToAxes:boolean[] // = this.zerocoord(false); // true for each axis that we've moved on, and have a definite position for
    seenWordSet: {
        [key:string]:boolean
    }; // a mapping from word letters to boolean true if that word has been seen at least once
    tool?:number;
    countT:number;
    countM6: number;
    feed?: number
    motionMode?: 'G0' | 'G1' | 'G2' | 'G3'
    arcPlane?: number
    incremental?: boolean
    inverseFeed?: boolean
    units?: 'in' | 'mm'
    spindle?: boolean
    spindleDirection?: -1 | 1
    spindleSpeed?: number
    coolant?: false | 1 | 2 | 3
    activeCoordSys?: number
    pos: number[],
    mpos: number[]
    coordSysOffsets: number[][]
    offset?: (number|undefined)[]
    offsetEnabled?: boolean
    storedPositions: number[][]
    line?: number
    gcodeLine?: string
    homeDirection?:('+'|'-')[]
}

/**
 * This is a virtual machine that tracks the state of a gcode job as it executes, and annotates all gcode lines
 * with the state of the virtual machine before and after the gcode line executes.  This is necessary to find the actual positions
 * of the machine during a job.
 *
 * This virtual machine is primarily intended for analysis of jobs that are mostly machine movement, but also includes support
 * for some command codes.  Note that it is note a validator, and may not represent actual machine behavior with invalid gcode.
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
 * @class GcodeVM
 * @constructor
 * @param {Object} [options]
 *   @param {Controller} controller - The machine controller class instance for the gcode to run on.  Used to fetch initial state.
 *   @param {TightCNCServer} tightcnc - Server instance.  Can also be provided to get some initial state.
 *   @param {String[]} axisLabels - Override default axis labels.  Defaults come from the controller, or are [ 'x', 'y', 'z' ].
 *   @param {Number|Number[]} maxFeed - Maximum feed rate, used to calculate time for G0 moves.  Can be a number, or an array of
 *     per-axis numbers.
 *   @param {Number|Number[]} acceleration - Acceleration, either as a number or per-axis.
 *   @param {Number} minMoveTime - Minimum time to count for a move.  Can be set to a low value to compensate for delays if lots
 *     of small moves aren't filling the controller's buffer.
 */
export default class GcodeVM {

    vmState: VMState = {
        pos: [],
        mpos: [],
        axisLabels: [],
        coord:this.coord.bind(this),
        totalTime:0, // seconds
        bounds:[[],[]],// min and max points
        mbounds: [[], []], // bounds for machine coordinates
        lineCounter:0,
        hasMovedToAxes: [], // true for each axis that we've moved on, and have a definite position for
        seenWordSet: {},// a mapping from word letters to boolean true if that word has been seen at least once
        tool:undefined,
        countT:0,
        countM6: 0,
        storedPositions: [],
        coordSysOffsets: []
    }

    _lastMoveAxisFeeds?:(number|undefined)[]

    constructor(public options:GcodeVMOptions) {
        this.options = options;
        if (!options.maxFeed) options.maxFeed = 1000;
        if (!options.acceleration) options.acceleration = 100000;
        if (!options.noInit) this.init();
    }

    // Gets or sets an axis value in a coordinate array.
    // If value is null, it returns the current value.  If value is numeric, it sets it.
    coord(coords:number[], axis:number|string, value?:number):number|undefined {
        let axisNum = (typeof axis === 'number') ? axis : this.vmState?.axisLabels?.indexOf(axis.toLowerCase()) || 0;
        if (axisNum === -1) throw  errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Invalid axis ' + axis);
        if (axisNum < 0 || axisNum >= this.vmState!.axisLabels!.length) throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Axis out of bounds ' + axisNum);
        //if (typeof value === 'number') {
        if (value !== undefined) {
            while (axisNum >= coords.length) coords.push(0);
            coords[axisNum] = value;
        } else {
            return coords[axisNum] || 0;
        }
    }

    public zerocoord<T>(val:T):T[] {
        let coords:T[] = [];
        for (let i = 0; i < this.vmState.axisLabels.length; i++) coords.push(val);
        return coords;
    }

    /**
     * Initialize the VM state if not performed in the constructor.
     *
     * @method init
     */
    init() {
        this.reset();
    }

    reset() {
        //let controller = this.options.controller || (this.options.tightcnc && this.options.tightcnc.controller) || {};
        let vmState: VMState = {
            pos: [],
            mpos: [],
            axisLabels: [],
            coord:this.coord.bind(this),
            totalTime:0, // seconds
            bounds:[this.zerocoord<number|null>(null), this.zerocoord(null)],// min and max points
            mbounds:[this.zerocoord(null), this.zerocoord(null)], // bounds for machine coordinates
            lineCounter:0,
            hasMovedToAxes: this.zerocoord<boolean>(false), // true for each axis that we've moved on, and have a definite position for
            seenWordSet: {},// a mapping from word letters to boolean true if that word has been seen at least once
            tool:undefined,
            countT:0,
            countM6: 0,
            storedPositions: [],
            coordSysOffsets: []
        };
        this.vmState = vmState;
        this.syncStateToMachine();
    }

    /**
     * Returns gcode needed to set a physical machine's state to this virtual machine's state.
     *
     * Currently supported state properties:
     * - spindle (includes spindleSpeed, spindleDirection)
     * - coolant
     * - feed
     * - incremental
     * - motionMode
     * - arcPlane
     * - inverseFeed
     * - units
     * - tool
     * - activeCoordSys
     *
     * @method syncMachineToState
     * @param {Object} options
     *   @param {Object} [options.vmState=null] - Use a GcodeVM state object instead of this instance's current state
     *   @param {String[]) [options.include] - List of state properties to include from those available.
     *   @param {String[]} [options.exclude] - List of state properties to exclude from those available.
     * @return {GcodeLine[]} - Array of GcodeLines
     */
    syncMachineToState(options: {
        vmState?:VMState,
        include: string[],
        exclude: string[]
    }):GcodeLine[] {
        const shouldInclude = (prop:string) => {
            if (!options.include && !options.exclude) return true;
            if (options.include && options.exclude && options.include.indexOf(prop) !== -1 && options.exclude.indexOf(prop) === -1) return true;
            if (!options.include && options.exclude && options.exclude.indexOf(prop) === -1) return true;
            if (options.include && !options.exclude && options.include.indexOf(prop) !== -1) return true;
            return false;
        };
        let vmState = options.vmState || this.vmState;
        let ret = [];

        // tool change
        if (typeof vmState?.tool === 'number' && shouldInclude('tool')) {
            ret.push(new GcodeLine('T' + vmState.tool));
            if (vmState.countM6) ret.push(new GcodeLine('M6'));
        }

        // feed rate
        if (vmState?.feed && shouldInclude('feed')) {
            ret.push(new GcodeLine('F' + vmState.feed));
        }

        // motion mode
        if (vmState?.motionMode && shouldInclude('motionMode')) {
            ret.push(new GcodeLine(vmState.motionMode));
        }

        // arc plane
        if (typeof vmState?.arcPlane === 'number' && shouldInclude('arcPlane')) {
            if (vmState.arcPlane === 0) {
                ret.push(new GcodeLine('G17'));
            } else if (vmState.arcPlane === 1) {
                ret.push(new GcodeLine('G18'));
            } else if (vmState.arcPlane === 2) {
                ret.push(new GcodeLine('G19'));
            }
        }

        // incremental mode
        if (typeof vmState?.incremental === 'boolean' && shouldInclude('incremental')) {
            if (vmState.incremental) {
                ret.push(new GcodeLine('G91'));
            } else {
                ret.push(new GcodeLine('G90'));
            }
        }

        // feed rate mode
        if (typeof vmState?.inverseFeed === 'boolean' && shouldInclude('inverseFeed')) {
            if (vmState.inverseFeed) {
                ret.push(new GcodeLine('G93'));
            } else {
                ret.push(new GcodeLine('G94'));
            }
        }

        // units
        if (vmState?.units && shouldInclude('units')) {
            if (vmState.units === 'in') {
                ret.push(new GcodeLine('G20'));
            } else if (vmState.units === 'mm') {
                ret.push(new GcodeLine('G21'));
            }
        }

        // spindle
        if (vmState?.spindle !== null && vmState?.spindle !== undefined && shouldInclude('spindle')) {
            if (vmState.spindle) {
                let word = (vmState.spindleDirection === -1) ? 'M4' : 'M3';
                let sword = vmState.spindleSpeed ? (' S' + vmState.spindleSpeed) : '';
                ret.push(new GcodeLine(word + sword));
            } else {
                ret.push(new GcodeLine('M5'));
            }
        }

        // coolant
        if (vmState?.coolant !== null && vmState?.coolant !== undefined && shouldInclude('coolant')) {
            if (vmState.coolant === 1 || vmState.coolant === 3) {
                ret.push(new GcodeLine('M7'));
            }
            if (vmState.coolant === 2 || vmState.coolant === 3) {
                ret.push(new GcodeLine('M8'));
            }
            if (!vmState.coolant) {
                ret.push(new GcodeLine('M9'));
            }
        }

        // Active coord sys
        if (vmState?.activeCoordSys !== null && vmState?.activeCoordSys !== undefined && shouldInclude('activeCoordSys')) {
            // TODO: Support for higher coordinate systems
            if (vmState.activeCoordSys < 6) {
                ret.push(new GcodeLine('G' + (54 + vmState.activeCoordSys)));
            }
        }

        return ret;
    }

    syncStateToMachine(options?:{
        vmState?: VMState,
        controller: Controller
        include?: string[],
        exclude?: string[]
    }):void {
        const shouldInclude = (prop: string) => {
            if (!options || (!options.include && !options.exclude)) return true;
            if (options.include && options.exclude && options.include.indexOf(prop) !== -1 && options.exclude.indexOf(prop) === -1) return true;
            if (!options.include && options.exclude && options.exclude.indexOf(prop) === -1) return true;
            if (options.include && !options.exclude && options.include.indexOf(prop) !== -1) return true;
            return false;
        };

        let controller = options?.controller || this.options.controller || (this.options.tightcnc?this.options.tightcnc.controller:undefined);
        let vmState = options?.vmState || this.vmState || {};

        if (shouldInclude('axisLabels')) vmState.axisLabels = objtools.deepCopy(this.options.axisLabels || controller?.axisLabels || ['x', 'y', 'z']);
        if (shouldInclude('mpos')) vmState.mpos = objtools.deepCopy(controller?.mpos || this.zerocoord(null));
        if (shouldInclude('pos')) vmState.pos = objtools.deepCopy((controller?.getPos && controller?.getPos()) || controller?.pos || this.zerocoord(null));
        if (shouldInclude('activeCoordSys')) vmState.activeCoordSys = (typeof controller?.activeCoordSys === 'number') ? controller.activeCoordSys : undefined;
        if (shouldInclude('coordSysOffsets')) vmState.coordSysOffsets = objtools.deepCopy(controller?.coordSysOffsets || [this.zerocoord(null)]);
        if (shouldInclude('offset')) vmState.offset = controller?.offset || this.zerocoord(0);
        if (shouldInclude('offsetEnabled')) vmState.offsetEnabled = controller?.offsetEnabled || false;
        if (shouldInclude('storedPositions')) vmState.storedPositions = objtools.deepCopy(controller?.storedPositions || [this.zerocoord<number|undefined>(undefined), this.zerocoord<number|undefined>(undefined)]);
        if (shouldInclude('units')) vmState.units = controller?.units || 'mm';
        if (shouldInclude('feed')) vmState.feed = controller?.feed || (Array.isArray(this.options.maxFeed) ? this.options.maxFeed[0] : this.options.maxFeed);
        if (shouldInclude('incremental')) vmState.incremental = controller?.incremental || false;
        if (shouldInclude('coolant')) vmState.coolant = controller?.coolant || false;
        if (shouldInclude('spindle')) vmState.spindle = controller?.spindle || false;
        if (shouldInclude('line')) vmState.line = controller?.line || 0;
        if (shouldInclude('spindle')) vmState.spindleDirection = controller?.spindleDirection || 1;
        if (shouldInclude('spindle')) vmState.spindleSpeed = controller?.spindleSpeed;
        if (shouldInclude('inverseFeed')) vmState.inverseFeed = controller?.inverseFeed || false;
        if (shouldInclude('motionMode')) vmState.motionMode = controller?.motionMode;
        if (shouldInclude('arcPlane')) vmState.arcPlane = controller?.arcPlane || 0;
        if (shouldInclude('tool')) vmState.tool = (controller?.tool !== null && controller?.tool !== undefined) ? controller.tool : undefined;
    }

    getState() {
        return this.vmState;
    }

    _convertCoordSys(pos:(number|undefined)[], fromCoordSys?:number, toCoordSys?:number, fromOffset?:(number|undefined)[], toOffset?:(number|undefined)[]):number[] {
        let vmState = this.vmState;
        let retPos:number[] = [];
        for (let axisNum = 0; axisNum < pos.length; axisNum++) {
            let fromTotalOffset = 0;
            let toTotalOffset = 0;
            if (typeof fromCoordSys === 'number') {
                fromTotalOffset += (vmState?.coordSysOffsets![fromCoordSys] || [])[axisNum] || 0;
            }
            if (typeof toCoordSys === 'number') {
                toTotalOffset += (vmState?.coordSysOffsets![toCoordSys] || [])[axisNum] || 0;
            }
            if (fromOffset) {
                fromTotalOffset += fromOffset[axisNum] || 0;
            }
            if (toOffset) {
                toTotalOffset += toOffset[axisNum] || 0;
            }
            retPos.push((pos[axisNum] || 0) + fromTotalOffset - toTotalOffset);
        }
        return retPos;
    }

    _updateMPosFromPos() {
        this.vmState.mpos = this._convertCoordSys(this.vmState.pos, this.vmState.activeCoordSys, undefined, this.vmState.offsetEnabled?this.vmState.offset:undefined, undefined);
    }

    _updatePosFromMPos() {
        this.vmState.pos = this._convertCoordSys(this.vmState.mpos, undefined, this.vmState.activeCoordSys, undefined, this.vmState.offsetEnabled?this.vmState.offset:undefined);
    }

    _updateBounds(bounds:number[][], pos:number[], axisFlags?:boolean[]) {
        for (let axisNum = 0; axisNum < pos.length; axisNum++) {
            let v = pos[axisNum];
            if (typeof v !== 'number' || (axisFlags && !axisFlags[axisNum])) continue;
            if (bounds[0][axisNum] === null || v < bounds[0][axisNum]) {
                bounds[0][axisNum] = v;
            }
            if (bounds[1][axisNum] === null || v > bounds[1][axisNum]) {
                bounds[1][axisNum] = v;
            }
        }
    }

    _processMove(to:number[], axisFlags?:boolean[], feed?:number, travel?:number, incremental?:boolean) {
        if (incremental) {
            // Update pos if incremental coordinates
            to = objtools.deepCopy(to);
            for (let axisNum = 0; axisNum < this.vmState.pos.length; axisNum++) {
                to[axisNum] = (to[axisNum] || 0) + this.vmState.pos[axisNum];
            }
        }
        // Calculate distance travelled if not provided
        if (!travel) {
            let travelSq = 0;
            for (let axisNum = 0; axisNum < this.vmState.pos.length; axisNum++) {
                if (to[axisNum] === null || to[axisNum] === undefined) to[axisNum] = this.vmState.pos[axisNum];
                travelSq += Math.pow((to[axisNum] || 0) - (this.vmState.pos[axisNum] || 0), 2);
            }
            travel = Math.sqrt(travelSq);
        }
        let from = this.vmState.pos;
        let moveTime;
        if (this.vmState.inverseFeed && feed) {
            // Handle time calc if inverse feed
            // Calculate the minimum amount of time this move would take so we can compare it to the requested time
            let minTime = 0;
            for (let axisNum = 0; axisNum < to.length && axisNum < from.length; axisNum++) {
                let axisTravel = Math.abs(from[axisNum] - to[axisNum]);
                let axisFeed = Array.isArray(this.options.maxFeed) ? this.options.maxFeed[axisNum] : this.options.maxFeed;
                let travelTime = axisTravel / (axisFeed || 1000) * 60;
                if (travelTime > minTime) minTime = travelTime;
            }
            // Calculate move time
            let moveTime = 60 / feed;
            if (moveTime < minTime) moveTime = minTime;
        } else {
            //moveTime = (travel / feed) * 60; // <-- naive (infinite acceleration) move time calculation
            // NOTE: The below code to account for acceleration could certainly be improved; but to large extent, it's
            // actually controller-specific.  The accuracy of these time estimates will vary.
            // Approximate move time (making a few not necessarily true assumptions) is calculated by
            // starting with the move's time if it were operating at the full feed rate the whole time (infinite acceleration),
            // then deducting the extra time it would have taken to change from the previous move's feed to this move's feed.
            // This is calculated on a per-axis basis, taking the per-axis components of the feed rate.
            if (!this._lastMoveAxisFeeds) this._lastMoveAxisFeeds = [] // this.zerocoord();
            // calculate linear distance travelled (this, and other parts of this method, will need to be adjusted for nonlinear moves)
            let linearDist = 0;
            for (let axisNum = 0; axisNum < to.length; axisNum++) {
                let d = to[axisNum] - this.vmState.pos[axisNum];
                linearDist += d * d;
            }
            linearDist = Math.sqrt(linearDist);
            // Determine the axis that will require the most amount of time to change velocity
            let maxAccelTime = 0; // minutes
            let axisAccelTimes = [];
            let accelMin:number|undefined;
            for (let axisNum = 0; axisNum < to.length; axisNum++) {
                let accel = (Array.isArray(this.options.acceleration) ? this.options.acceleration[axisNum] : this.options.acceleration) || 0;
                if (!accelMin || accel < accelMin) accelMin = accel;
                let diff = to[axisNum] - this.vmState.pos[axisNum];
                // calculate feed component for this axis (may be negative to indicate negative direction)
                let axisFeed;
                if (!feed) { // G0
                    axisFeed = Array.isArray(this.options.maxFeed) ? this.options.maxFeed[axisNum] : this.options.maxFeed;
                } else {
                    axisFeed = diff / linearDist * feed; // in units/min
                }
                // Get and update the last move's axis feed rate
                let lastMoveAxisFeed = this._lastMoveAxisFeeds[axisNum];
                this._lastMoveAxisFeeds[axisNum] = axisFeed;
                // calculate amount of time it would take to accelerate between the feeds
                let accelTime = Math.abs(axisFeed! - lastMoveAxisFeed!) / accel; // min
                if (accelTime > maxAccelTime) maxAccelTime = accelTime;
                axisAccelTimes[axisNum] = accelTime;
            }
            // Determine the distance travelled for that acceleration time
            let accelDist = Math.abs((1 / 2) * accelMin! * (maxAccelTime * maxAccelTime));
            if (accelDist > travel) accelDist = travel;
            // Calcualate the base move time (time when travelling over move at max feed, minus the distances for acceleration)
            if (!feed) { // G0
                moveTime = 0;
                for (let axisNum = 0; axisNum < to.length && axisNum < from.length; axisNum++) {
                    let accel = Array.isArray(this.options.acceleration) ? this.options.acceleration[axisNum] : this.options.acceleration;
                    let axisAccelTime = axisAccelTimes[axisNum];
                    let axisAccelDist = Math.abs((1 / 2) * accel! * (axisAccelTime * axisAccelTime));
                    let axisTravel = Math.abs(to[axisNum] - this.vmState.pos[axisNum]);
                    if (axisAccelDist > axisTravel) axisAccelDist = axisTravel;
                    axisTravel -= axisAccelDist;
                    let axisFeed = Array.isArray(this.options.maxFeed) ? this.options.maxFeed[axisNum] : this.options.maxFeed;
                    let travelTime = axisTravel / (axisFeed || 1000); // minutes
                    travelTime += axisAccelTime;
                    if (travelTime > moveTime) moveTime = travelTime;
                }
            } else {
                moveTime = (travel - accelDist) / feed; // minutes
                // Add time to accelerate
                moveTime += maxAccelTime;
            }
            // convert to seconds
            moveTime *= 60;
        }
        if (this.options.minMoveTime && (moveTime||0) < this.options.minMoveTime) {
            moveTime = this.options.minMoveTime;
        }

        this.vmState.totalTime! += moveTime || 0;
        // Update local coordinates
        for (let axisNum = 0; axisNum < to.length; axisNum++) {
            this.vmState.pos[axisNum] = to[axisNum];
        }
        // Update machine position
        this._updateMPosFromPos();
        // Update bounds
        this._updateBounds(this.vmState.bounds as number[][], this.vmState.pos, axisFlags);
        this._updateBounds(this.vmState.mbounds as number[][], this.vmState.mpos, axisFlags);
        // Update hasMovedToAxes with axes we definitively know positions for
        if (!incremental && axisFlags) {
            for (let axisNum = 0; axisNum < axisFlags.length; axisNum++) {
                if (axisFlags[axisNum]) {
                    this.vmState.hasMovedToAxes[axisNum] = true;
                }
            }
        }
    }

    _setCoordSys(num?:number):void {
        this.vmState.pos = this._convertCoordSys(this.vmState.pos, this.vmState.activeCoordSys, num, undefined, undefined); // note, offsets from vmState.offset are cancelled out so don't need to be passed
        this.vmState.activeCoordSys = num;
    }

    /**
     * Run a line of gcode through the VM.
     *
     * @method runGcodeLine
     * @param {GcodeLine} gline - A parsed GcodeLine instance
     * @return {Object} - Contains keys 'state' (new state), 'isMotion' (whether the line indicates motion)
     */
    runGcodeLine(gline: GcodeLine): {
        state: VMState,
        isMotion: boolean
        motionCode: 'G0'|'G1'|'G2'|'G3', // If motion, the G code associated with the motion
        changedCoordOffsets: boolean, // whether or not anything was changed with coordinate systems
        time: number // estimated duration of instruction execution, in seconds

    } {
        gline = new GcodeLine(gline);
        // This is NOT a gcode validator.  Input gcode is expected to be valid and well-formed.
        //
        let vmState = this.vmState;
        vmState.gcodeLine = gline.toString()
        let origCoordSys = vmState.activeCoordSys;
        let origTotalTime = vmState.totalTime;
        let changedCoordOffsets = false;

        // Determine if this line represents motion
        let motionCode = null; // The G code on this line in the motion modal group (indicating some kind of machine motion)
        let hasCoords = []; // A list of axis word letters present (eg. [ 'X', 'Z' ]) 
        let coordPos = vmState.incremental ? this.zerocoord<number|undefined>(undefined) : objtools.deepCopy(vmState.pos); // Position indicated by coordinates present, filling in missing ones with current pos; unless incremental, then all zeroes
        let coordPosSparse = this.zerocoord<number|undefined>(undefined); // Position indicated by coordinates present, with missing axes filled in with nulls
        let coordFlags = this.zerocoord(false); // True in positions where coordinates are present

        // Determine which axis words are present and convert to coordinate arrays
        for (let axisNum = 0; axisNum < vmState.axisLabels!.length; axisNum++) {
            let axis = vmState.axisLabels![axisNum].toUpperCase();
            let val = gline.get(axis);
            if (typeof val === 'number') {
                hasCoords.push(axis);
                coordPos[axisNum] = val;
                coordPosSparse[axisNum] = val;
                coordFlags[axisNum] = true;
            }
            if (gline.has(axis)) hasCoords.push(axis);
        }

        // Check if a motion gcode is indicated (either by presence of a motion gcode word, or presence of coordinates without any other gcode)
        if (!gline.has('G') && hasCoords.length) {
            motionCode = vmState.motionMode;
        } else {
            motionCode = gline.get<string>('G', 'G0') as 'G0'|'G1'|'G2'|'G3';
            if (typeof motionCode === 'number') {
                motionCode = 'G' + motionCode;
                vmState.motionMode = motionCode as 'G0'|'G1'|'G2'|'G3';
            }
        }

        // Check if this is simple motion that can skip extra checks (for efficiency in the most common case)
        let isSimpleMotion = motionCode && (motionCode === 'G0' || motionCode === 'G1') && (gline.has(motionCode) ? 1 : 0) + (gline.has('F') ? 1 : 0) + (gline.has('N') ? 1 : 0) + hasCoords.length === gline.words?.length;

        // Update seenWordSet
        if(gline.words)for (let word of gline.words) {
            vmState.seenWordSet[word[0].toUpperCase()] = true;
        }

        // Check for other codes that set modals
        let tempCoordSys = false;
        let wordF = gline.get('F');
        if (typeof wordF === 'number') vmState.feed = wordF;
        if (!isSimpleMotion) {
            if (gline.has('G17')) vmState.arcPlane = 0;
            if (gline.has('G18')) vmState.arcPlane = 1;
            if (gline.has('G19')) vmState.arcPlane = 2;
            if (gline.has('G20')) vmState.units = 'in';
            if (gline.has('G21')) vmState.units = 'mm';
            for (let i = 0; i < 6; i++) {
                if (gline.has('G' + (54 + i))) {
                    this._setCoordSys(i);
                    changedCoordOffsets = true;
                }
            }
            if (gline.has('G80')) vmState.motionMode = undefined;
            if (gline.has('G90')) vmState.incremental = false;
            if (gline.has('G91')) vmState.incremental = true;
            if (gline.has('G93')) vmState.inverseFeed = true;
            if (gline.has('G94')) vmState.inverseFeed = false;
            if (gline.has('M2') || gline.has('M30')) {
                vmState.offset = this.zerocoord<number|undefined>(undefined);
                vmState.offsetEnabled = false;
                vmState.activeCoordSys = 0;
                vmState.arcPlane = 0;
                vmState.incremental = false;
                vmState.inverseFeed = false;
                vmState.spindle = false;
                vmState.motionMode = undefined;
                vmState.coolant = false;
                vmState.units = 'mm';
                changedCoordOffsets = true;
            }
            let wordS = gline.get('S');
            if (typeof wordS === 'number') vmState.spindleSpeed = wordS;
            if (gline.has('M3')) {
                vmState.spindleDirection = 1;
                vmState.spindle = true;
            }
            if (gline.has('M4')) {
                vmState.spindleDirection = -1;
                vmState.spindle = true;
            }
            if (gline.has('M5')) vmState.spindle = false;
            if (gline.has('M7')) {
                if (vmState.coolant === 2) vmState.coolant = 3;
                else vmState.coolant = 1;
            }
            if (gline.has('M8')) {
                if (vmState.coolant === 1) vmState.coolant = 3;
                else vmState.coolant = 2;
            }
            if (gline.has('M9')) vmState.coolant = false;


            // Check if temporary G53 coordinates are in effect
            if (gline.has('G53')) {
                tempCoordSys = true;
                this._setCoordSys();
            }
        }

        // Handle motion
        let doMotion = motionCode;
        let isMotion = false;
        if (!isSimpleMotion) {
            if (gline.has('G28')) doMotion = 'G28';
            if (gline.has('G30')) doMotion = 'G30';
        }
        if (doMotion === 'G0') {
            if (hasCoords.length) {
                this._processMove(coordPos, coordFlags, undefined, undefined, vmState.incremental);
                isMotion = true;
            }
        } else if (doMotion === 'G1') {
            if (hasCoords.length) {
                this._processMove(coordPos, coordFlags, vmState.feed, undefined, vmState.incremental);
                isMotion = true;
            }
        } else if ((doMotion === 'G2' || doMotion === 'G3')) {
            if (hasCoords.length) {
                // TODO: calculate travel distance properly here
                this._processMove(coordPos, coordFlags, vmState.feed, undefined, vmState.incremental);
                isMotion = true;
            }
        } else if (doMotion === 'G28' || doMotion === 'G30') {
            if (hasCoords.length) {
                this._processMove(coordPos, coordFlags, vmState.feed, undefined, vmState.incremental);
            }
            let storedPos = vmState.storedPositions[(doMotion === 'G28') ? 0 : 1];
            storedPos = this._convertCoordSys(storedPos, undefined, vmState.activeCoordSys, undefined, vmState.offsetEnabled ? vmState.offset : undefined);
            this._processMove(storedPos, undefined, vmState.feed, undefined, false);
            isMotion = true;
        } else if (doMotion === 'G80') {
            // Motion Mode Cancel
            isMotion = false
        } else if (doMotion) {
            throw errRegistry.newError('INTERNAL_ERROR','UNSUPPORTED_OPERATION').formatMessage('Unsupported motion gcode ' + doMotion + ': ' + gline.toString());
        }

        if (!isSimpleMotion) {
            // Handle G10 L2
            if (gline.has('G10') && gline.has('L2') && gline.has('P') && hasCoords.length) {
                this._updateMPosFromPos();
                let newOffset = coordPosSparse.map((v) => (v || 0));
                let coordSys = gline.get('P') as number - 1;
                vmState.coordSysOffsets[coordSys] = newOffset;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }
            // Handle G10 L20
            if (gline.has('G10') && gline.has('L20') && gline.has('P') && hasCoords.length) {
                this._updateMPosFromPos();
                let newOffset = coordPosSparse.map((v) => (v || 0)).map((v, i) => (vmState.mpos[i] || 0) - v);
                let coordSys = gline.get('P') as number - 1;
                vmState.coordSysOffsets[coordSys] = newOffset;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }

            // Handle G28.1
            if (gline.has('G28.1')) {
                vmState.storedPositions[0] = objtools.deepCopy(vmState.mpos);
            }
            if (gline.has('G30.1')) {
                vmState.storedPositions[1] = objtools.deepCopy(vmState.mpos);
            }

            // Handle homing (can't really be handled exactly correctly without knowing actual machine position)
            if (gline.has('G28.2') || gline.has('G28.3')) {
                for (let axisNum = 0; axisNum < coordPosSparse.length; axisNum++) {
                    if (coordPosSparse[axisNum] !== null) vmState.mpos[axisNum] = 0;
                }
                changedCoordOffsets = true;
            }

            // Handle G92
            if (gline.has('G92')) {
                this._updateMPosFromPos();
                vmState.offset = coordPosSparse.map((v) => (v || 0));
                vmState.offsetEnabled = true;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }
            if (gline.has('G92.1')) {
                this._updateMPosFromPos();
                vmState.offset = this.zerocoord(undefined);
                vmState.offsetEnabled = false;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }
            if (gline.has('G92.2')) {
                this._updateMPosFromPos();
                vmState.offsetEnabled = false;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }
            if (gline.has('G92.3')) {
                this._updateMPosFromPos();
                vmState.offsetEnabled = true;
                this._updatePosFromMPos();
                changedCoordOffsets = true;
            }
            // Handle dwell
            if (gline.has('G4') && gline.has('P')) {
                vmState.totalTime += gline.get('P') as number;
            }

            // Handle T
            if (gline.has('T')) {
                vmState.tool = gline.get('T') as number;
                vmState.countT++;
            }
            if (gline.has('M6')) {
                vmState.countM6++;
            }
        }

        // Handle line number
        let lineNum = gline.get('N') as number;
        if (lineNum !== null) vmState.line = lineNum;

        // Add to line counter
        vmState.lineCounter++;
        //console.log(vmState.lineCounter,vmState.gcodeLine)

        // Reset coordinate system if using G53
        if (tempCoordSys) this._setCoordSys(origCoordSys);

        // Return state info
        return {
            state: vmState, // VM state after executing line
            isMotion: isMotion, // whether the line represents motion
            motionCode: motionCode as 'G0'|'G1'|'G2'|'G3', // If motion, the G code associated with the motion
            changedCoordOffsets: changedCoordOffsets, // whether or not anything was changed with coordinate systems
            time: (vmState!.totalTime || 0) - (origTotalTime || 0) // estimated duration of instruction execution, in seconds
        };
    }

}