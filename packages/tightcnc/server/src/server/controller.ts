import EventEmitter from 'events';
import * as node_stream from 'stream'
import { GcodeLine } from './new-gcode-processor/GcodeLine';
import { BaseRegistryError } from 'new-error';
import fs from 'fs'
import { VMState } from './new-gcode-processor/GcodeVM'
import CrispHooks from 'crisphooks'
import { errRegistry } from './errRegistry';

export interface ControllerConfig {
    port: string
    homableAxes?: [boolean, boolean, boolean]
    streamSendQueueHighWaterMark?: number
    streamSendQueueLowWaterMark?: number
    realTimeMovesMaxQueued?: number
    realTimeMovesMaxOvershootFactor?:number

}

export interface ControllerCapabilities {
        variableSpindle:boolean // 'V': 'variableSpindle',
   //     'N': 'lineNumbers',
        mistCoolant: boolean, //'M': 'mistCoolant',
        floodCoolant: boolean,
        coreXY: boolean, // 'C': 'coreXY',
    //    'P': 'parking',
    //    'Z': 'homingForceOrigin',
        homingSingleAxis:boolean, //'H': 'homingSingleAxis', $HX $HY $HZ
    //    'T': 'twoLimitSwitch',
    //    'A': 'allowProbeFeedOverride',
    //    '*': 'disableRestoreAllEEPROM',
    //    '$': 'disableRestoreSettings',
    //    '#': 'disableRestoreParams',
    //    'I': 'disableBuildInfoStr',
    //    'E': 'disableSyncOnEEPROMWrite',
    //    'W': 'disableSyncOnWCOChange',
        startUpHomeLock: boolean // 'L': 'powerUpLockWithoutHoming'
}

export interface ControllerStatus extends VMState {
    ready: boolean,
    /*
    axisLabels: string[],
    */
    usedAxes: boolean[],
    axisMaxFeeds: number[]
    axisMaxTravel: number[]
    /*
    mpos: number[],
    pos: number[],
    */
    mposOffset: number[],
    /*
    activeCoordSys: number,
    offset:number[],
    offsetEnabled: boolean,
    storedPositions: number[][],
    */
    homed: boolean[],
    held: boolean,
    /*
    units: 'mm'|'in',
    feed: number,
    incremental: boolean,
    */
    moving: boolean,
    /*
    coolant: number,
    spindle: boolean,
    spindleDirection: number;
    spindleSpeed: number;
    line: number,
    */
    error: boolean,
    errorData?: BaseRegistryError,
    programRunning: boolean,
    capabilities: ControllerCapabilities   
    spindleSpeedMax?: number,
    spindleSpeedMin?: number
}

export default abstract class Controller  extends EventEmitter implements VMState  {

    axisLabels=['x', 'y', 'z'];
    ready = false;
    usedAxes = [true, true, true];
    homableAxes = [true, true, true];
    axisMaxFeeds = [500, 500, 500];
    axisMaxTravel:number[] = []
    mpos = [0, 0, 0];
    activeCoordSys?:number = 0;
    coordSysOffsets = [[0, 0, 0]];
    offset = [0, 0, 0];
    offsetEnabled = false;
    storedPositions = [[0, 0, 0], [0, 0, 0]];
    homed = [false, false, false];
    held = false;
    units:'mm'|'in' = 'mm';
    feed = 0;
    incremental = false;
    moving = false;
    coolant:false|1|2|3 = false;
    spindle = false;
    line = 0;
    error = false;
    errorData?:BaseRegistryError;
    programRunning = false;
    spindleDirection:-1|1 = 1;
    spindleSpeed?:number;
    inverseFeed = false;
    spindleSpeedMax?: number
    spindleSpeedMin?: number
    homeDirection?: ('+'|'-')[]

    coord?: ((coords: number[], axis: string | number, value?: number | undefined) => number | undefined) | undefined;
    totalTime: number = 0;
    bounds?: [(number | null)[], (number | null)[]] | undefined;
    mbounds?: [(number | null)[], (number | null)[]] | undefined;
    lineCounter: number = 0;
    hasMovedToAxes: boolean[] = [false,false,false];
    seenWordSet: {
        [key:string]:boolean
    } = {};
    tool?: number;
    countT: number = 0;
    countM6: number = 0;
    motionMode?: 'G0' | 'G1' | undefined;
    arcPlane?: number | undefined;
    pos: number[] = [0,0,0];


    /**
     * Base class for CNC controllers.  Each subclass corresponds to a type of CNC controller and manages the connection
     * to that controller.
     *
     * Events that should be emitted:
     *   - statusUpdate - When the status variables are updated.  No parameters.
     *   - connected - When the connection is established (often immediately preceeds ready).
     *   - ready - When the connection is ready for use and machine is not alarmed.
     *   - sent - When raw data is sent, argument should be raw data string. (newline may be absent)
     *   - received - When raw data is received, argument should be raw data string. (newline may be absent)
     *   - error - Self-explanatory
     *
     * @class Controller
     * @constructor
     * @param {Object} config - Controller-specific configuration blob
     */
    constructor(public config:ControllerConfig) {
        super();
        // See resetState() for property definitions.
        this.resetState();
    }

    /**
     *  Perform the disconnection from the controlle 
     */
    async disconnect(): Promise<void> {
    }


    /**
     * Gets current offsets from machine coordinate system.
     *
     * @method getCoordOffsets
     * @return {Number[]}
     */
    getCoordOffsets():number[] {
        let offsets = [];
        for (let i = 0; i < this.axisLabels.length; i++)
            offsets[i] = 0;
        if (typeof this.activeCoordSys === 'number' && this.activeCoordSys >= 0) {
            // Not machine coordinates; set offsets from this coord system
            let csysOffsets = this.coordSysOffsets[this.activeCoordSys];
            if (csysOffsets) {
                for (let i = 0; i < csysOffsets.length; i++) {
                    offsets[i] += csysOffsets[i];
                }
            }
        }
        if (this.offsetEnabled && this.offset) {
            for (let i = 0; i < this.offset.length; i++) {
                offsets[i] += this.offset[i];
            }
        }
        return offsets;
    }
    /**
     * Gets the position in current coordinate system, with offset.
     *
     * @method getPos
     * @return {Number[]}
     */
    getPos() {
        let off = this.getCoordOffsets();
        let r = [];
        for (let i = 0; i < this.mpos.length; i++) {
            let o = off[i] || 0;
            r.push(this.mpos[i] - o);
        }
        return r;
    }
    /**
     * Resets state properties to defaults.
     *
     * @method resetState
     */
    resetState() {
        // Whether or not the machine is connected and ready to accept input
        this.ready = false;
        // Labels for each of the axes
        this.axisLabels = ['x', 'y', 'z'];
        // Which axes are actually used
        this.usedAxes = [true, true, true];
        // Which axes can be automatically homed
        this.homableAxes = [true, true, true];
        // Current coordinates in machine position for each of the axes
        this.mpos = [0, 0, 0];
        // Currently active coordinate system.  0 corresponds to G54, 1 to G55, etc.  null means G53 machine coordinates.
        this.activeCoordSys = 0;
        // For each coordinate system, the offsets for that system to the machine coordinates
        this.coordSysOffsets = [[0, 0, 0]];
        // Configured offset (set by G92)
        this.offset = [0, 0, 0];
        // Whether the current G92 offset is enabled
        this.offsetEnabled = false;
        // Stored machine positions; 0 corresponds to G28, 1 corresponds to G30
        this.storedPositions = [[0, 0, 0], [0, 0, 0]];
        // Whether machine is homed, for each axis
        this.homed = [false, false, false];
        // If the machine is currently paused / feed hold
        this.held = false;
        // Current units configured for machine; 'mm' or 'in'
        this.units = 'mm';
        // Current feed rate for machine
        this.feed = 0;
        // Whether machine is currently in incremental mode
        this.incremental = false;
        // If the machine is currently moving
        this.moving = false;
        // If coolant is running.  Can also be 1 or 2 for mist or flood coolant, or 3 for both.
        this.coolant = false;
        // If spindle is running
        this.spindle = false;
        // Last line number executed
        this.line = 0;
        // true if the machine is in an error/alarm state
        this.error = false;
        // Additional information about the error.  Must be an XError object.
        this.errorData = undefined;
        // true if a program is running
        this.programRunning = false;
        // 1 for CW, -1 for CCW
        this.spindleDirection = 1;
        // Speed of spindle, if known
        this.spindleSpeed = undefined;
        // True for inverse feedrate mode
        this.inverseFeed = false;
        // Spindle
        this.spindleSpeedMax = undefined
        this.spindleSpeedMin = undefined
        this.homeDirection = undefined
    }
    /**
     * Initialize and connect to CNC machine.  Should update machine state properties as much as is possible.
     *
     * @method initConnection
     * @param {Boolean} retry - Whether to continue retrying to connect on error
     */
    initConnection(retry = true) { }
    /**
     * Send a string line to the controller.
     *
     * @method sendLine
     * @param {String} line - The string to send, without a \n at the end.
     * @param {Object} [options] - Controller-specific options
     */
    abstract sendLine(line:string, options?:{}):void 
    /**
     * Send a GcodeLine object to the controller.  The GcodeLine object may optionally contain hooks as a
     * crisphooks instance (ie, using crisphooks.addHooks()).  If hooks are attached to the GcodeLine, the
     * following events will be fired.  Every event will be fired once, in order, for every given line.  The
     * only exception is the 'error' event, which, if it occurs, will cause no more events to be fired after.
     * If a controller does not support detecting one or more of these events, the events should be fired
     * anyway, in their proper order, as close to reality as can be determined.
     *
     * Supported events:
     * - error - When an error occurs before or during processing of the line.  Also used for cancellation.
     *     The parameter to the hook is the error object.
     * - queued - When the line is queued to be sent.
     * - sent - When the line is sent to the device.
     * - ack - When the device acknowledges receipt of the line.
     * - executing - When the instruction starts executing.
     * - executed - When the instruction has finished executing.
     *
     * @method sendGcode
     * @param {GcodeLine} gline
     * @param {Object} [options] - Controller-specific options
     */
    abstract sendGcode(gline: GcodeLine, options?:{}):void;

    send(thing: string | GcodeLine, options?:{}):void {
        if (typeof thing === 'object' && thing.isGcodeLine) {
            this.sendGcode(thing as GcodeLine, options);
        } else {
            this.sendLine(thing as string, options);
        }
    }
    /**
     * Streams lines to the controller, as in send().  Should only resolve once whole stream has been executed.
     *
     * @method sendStream
     * @param {ReadableString} stream - Readable object stream.  Each object can either be a string (without a newline - newlines should be
     *   added), or an instance of GcodeLine.  This can either be a zstreams ReadableStream or a vanilla ReadableStream.  They act the same
     *   for the most part, but error handling is a bit different.
     * @return {Promise} - Resolves when whole stream has been sent, and movements processed.
     */
    abstract sendStream(stream: node_stream.Readable ): Promise<void>;

    sendFile(filename: string):Promise<void> {
   //     let stream = zstreams.fromFile(filename).pipe(new zstreams.SplitStream());
        /** FIXME: Very bad for big file */
        let stream =node_stream.Readable.from(fs.readFileSync(filename as string).toString().split(/\r?\n/))
        return this.sendStream(stream);
    }
    /**
     * Returns a promise that resolves when the machine state properties on this class have been fully synchronized with
     * the machine.  Generally this means that all movement has stopped, all sent lines have been processed, and there's nothing
     * left in the queue.  Calling this function may or may not temporarily pause the send queue.  After the returned promise resolves,
     * the state variables are only guaranteed to be in sync until the next send queue entry is sent (which might be right away).
     * To guarantee proper operation, no other commands should be sent until after this function resolves.
     *
     * @method waitSync
     * @return {Promise}
     */
    waitSync() { }
    /**
     * Pauses machine / feed hold.
     *
     * @method hold
     */
    hold() { }
    /**
     * Resumes paused/held machine.
     *
     * @method resume
     */
    resume() { }
    /**
     * Cancels any current operations and flushes queue.  If machine is in feed hold, unhold.
     *
     * @method cancel
     */
    cancel() { }
    /**
     * Resets machine.
     *
     * @method reset
     */
    reset() { }
    /**
     * Clears a current error state, if possible.
     *
     * @method clearError
     */
    clearError() { }
    /**
     * Move by inc in direction of axis.  If this is called multiple times before a previous move is completed, extra invocations
     * should be ignored.  This is used for real-time control of the machine with an interface.
     *
     * @method realTimeMove
     * @param {Number} axis - Axis number.  0=x, 1=y, etc.
     * @param {Number} inc - Increment to move axis by.
     */
    realTimeMove(axis:number, inc:number) { }
    /**
     * Moves machine linearly to point, resolving promise when movement is complete and machine is stopped.
     * Should not be called simultaneously with any other functions.  Promise should error if a cancel() is
     * executed before the move completes.  (G0/G1)
     *
     * @method move
     * @param {Number[]} pos - Position to move to.  Array elements may be null/undefined to not move on that axis.
     * @param {Number} [feed] - Optional feed rate to move at.
     * @return {Promise} - Resolve when move is complete and machine is stopped.
     */
    move(pos:(number|false)[], feed?:number) { }
    /**
     * Home machine. (G28.2)
     *
     * @method home
     * @param {Boolean[]} axes - true for each axis to home; false for others
     * @return {Promise} - Resolves when homing is complete.
     */
    abstract home(axes?: boolean[]): Promise<void>;
    /**
     * Probe toward position.  Resolve when probe trips.  Error if probe reaches position without tripping.  This should return
     * the position that the probe tripped at, and also ensure that the machine is positioned at that location.  pos parameter contains
     * nulls at all axes that are not moved.
     *
     * @method probe
     * @param {Number[]} pos
     * @param {Number} [feed]
     * @return {Promise{pos}}
     */
    probe(pos: (number | boolean)[], feed?: number): Promise<number[]> {
        throw errRegistry.newError('INTERNAL_ERROR','UNSUPPORTED_OPERATION').formatMessage('Probe is not availble in this controller!')
     }
    /**
     * Return an object containing controller status.  Controller classes may override this, but should make an effort
     * to conform as much as possible to the format of this status object.
     *
     * @method getStatus
     * @return {Object}
     */
    getStatus():ControllerStatus {
        let c = this;
        return {
            ready: c.ready,
            axisLabels: c.axisLabels,
            usedAxes: c.usedAxes,
            axisMaxFeeds: c.axisMaxFeeds,
            axisMaxTravel: c.axisMaxTravel,
            mpos: c.mpos,
            pos: c.getPos(),
            mposOffset: c.getCoordOffsets(),
            activeCoordSys: c.activeCoordSys,
            offset: c.offset,
            offsetEnabled: c.offsetEnabled,
            storedPositions: c.storedPositions,
            homed: c.homed,
            held: c.held,
            units: c.units,
            feed: c.feed,
            incremental: c.incremental,
            moving: c.moving,
            coolant: c.coolant,
            spindle: c.spindle,
            spindleDirection: c.spindleDirection,
            spindleSpeed: c.spindleSpeed || 0,
            spindleSpeedMax: c.spindleSpeedMax,
            spindleSpeedMin: c.spindleSpeedMin,            
            line: c.line,
            error: c.error,
            errorData: c.errorData,
            programRunning: c.programRunning,
            capabilities: {
                variableSpindle:false, // 'V': 'variableSpindle',
                mistCoolant: false, //'M': 'mistCoolant',
                floodCoolant: false,
                coreXY: false, // 'C': 'coreXY',
                homingSingleAxis:false, //'H': 'homingSingleAxis', $HX $HY $HZ
                startUpHomeLock: false // 'L': 'powerUpLockWithoutHoming'
            },
            lineCounter: c.lineCounter,
            hasMovedToAxes: c.hasMovedToAxes,
            countM6: c.countM6,
            coordSysOffsets: c.coordSysOffsets,
            countT: c.countT,
            seenWordSet: c.seenWordSet,
            totalTime: c.totalTime,
            homeDirection: c.homeDirection
        } as ControllerStatus;
    }
    listUsedAxisNumbers() {
        let ret = [];
        for (let axisNum = 0; axisNum < this.usedAxes.length; axisNum++) {
            if (this.usedAxes[axisNum])
                ret.push(axisNum);
        }
        return ret;
    }
    listUsedAxisLabels() {
        let ret = [];
        for (let axisNum = 0; axisNum < this.usedAxes.length; axisNum++) {
            if (this.usedAxes[axisNum]) {
                ret.push(this.axisLabels[axisNum]);
            }
        }
        return ret;
    }
}
