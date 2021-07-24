import EventEmitter from 'events';
import * as node_stream from 'stream'
import { GcodeLine } from './gcode-processor/GcodeLine';
import { BaseRegistryError } from 'new-error';
import fs from 'fs'
import { VMState } from './gcode-processor/VMState';
import { errRegistry } from './errRegistry';
import { ControllerConfig } from './ControllerConfig';

export interface ControllerCapabilities {
        variableSpindle:boolean // 'V': 'variableSpindle',
   //     'N': 'lineNumbers',
        mistCoolant: boolean, //'M': 'mistCoolant',
        floodCoolant: boolean,
        coreXY: boolean, // 'C': 'coreXY',
        parking: boolean, //    'P': 'parking',
        homeForce: boolean,//    'Z': 'homingForceOrigin',
        homing: boolean, // 'H': 'homing',
        homingSingleAxis:boolean, //'H': 'homingSingleAxis', $HX $HY $HZ
    //    'T': 'twoLimitSwitch',
    //    'A': 'allowProbeFeedOverride',
    //    '*': 'disableRestoreAllEEPROM',
    //    '$': 'disableRestoreSettings',
    //    '#': 'disableRestoreParams',
    //    'I': 'disableBuildInfoStr',
    //    'E': 'disableSyncOnEEPROMWrite',
    //    'W': 'disableSyncOnWCOChange',
    startUpHomeLock: boolean,// 'L': 'powerUpLockWithoutHoming'
    toolchange: boolean,    
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

export abstract class Controller  extends EventEmitter implements VMState  {

    axisLabels=['x', 'y', 'z'];
    ready = false;
    usedAxes = [true, true, true];
    homableAxes = [true, true, true];
    axisMaxFeeds:number[] = [500, 500, 500];
    axisMaxTravel:number[] = []
    mpos = [0, 0, 0];
    activeCoordSys?:number|undefined = 0;
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

    coord?: (coords: number[], axis: string | number, value?: number | undefined) => number | undefined;
    totalTime = 0;
    bounds?: [(number | null)[], (number | null)[]];
    mbounds?: [(number | null)[], (number | null)[]];
    lineCounter = 0;
    hasMovedToAxes: boolean[] = [false,false,false];
    seenWordSet: {
        [key:string]:boolean
    } = {};
    tool?: number;
    countT = 0;
    countM6 = 0;
    motionMode?: 'G0' | 'G1' ;
    arcPlane?: number;
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

    [key: string]: unknown;
    
    gcodeLine?: string | undefined;

    /**
     *  Perform the disconnection from the controlle 
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async disconnect(): Promise<void> {}


    /**
     * Gets current offsets from machine coordinate system.
     *
     * @method getCoordOffsets
     * @return {Number[]}
     */
    getCoordOffsets():number[] {
        const offsets = [];
        for (let i = 0; i < this.axisLabels.length; i++)
            offsets[i] = 0;
        if (typeof this.activeCoordSys === 'number' && this.activeCoordSys >= 0) {
            // Not machine coordinates; set offsets from this coord system
            const csysOffsets = this.coordSysOffsets[this.activeCoordSys];
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
        const off = this.getCoordOffsets();
        const r = [];
        for (let i = 0; i < this.mpos.length; i++) {
            const o = off[i] || 0;
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
        // Additional information about the error.  Must be an newError object.
        delete this.errorData;
        // true if a program is running
        this.programRunning = false;
        // 1 for CW, -1 for CCW
        this.spindleDirection = 1;
        // Speed of spindle, if known
        delete this.spindleSpeed;
        // True for inverse feedrate mode
        this.inverseFeed = false;
        // Spindle
        delete this.spindleSpeedMax
        delete this.spindleSpeedMin
        delete this.homeDirection
    }
    /**
     * Initialize and connect to CNC machine.  Should update machine state properties as much as is possible.
     *
     * @method initConnection
     * @param {Boolean} retry - Whether to continue retrying to connect on error
     */
    abstract initConnection(retry: boolean): Promise<void>;

    /**
     * Send a string line to the controller.
     *
     * @method sendLine
     * @param {String} line - The string to send, without a \n at the end.
     * @param {Object} [options] - Controller-specific options
     */
    abstract sendLine(line:string, options?:unknown):void 
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
    abstract sendGcode(gline: GcodeLine, options?:unknown):void;

    send(thing: string | GcodeLine, options?:unknown):void {
        if (typeof thing === 'string') {
            this.sendLine(thing, options);
        } else {
            this.sendGcode(thing, options);
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
        const stream =node_stream.Readable.from(fs.readFileSync(filename).toString().split(/\r?\n/))
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
    abstract waitSync(debug?: boolean): Promise<void>;
    /**
     * Pauses machine / feed hold.
     *
     * @method hold
     */
    abstract hold(): void;
    /**
     * Resumes paused/held machine.
     *
     * @method resume
     */
    abstract resume(): void;
    /**
     * Cancels any current operations and flushes queue.  If machine is in feed hold, unhold.
     *
     * @method cancel
     */
    abstract cancel(): void;
    /**
     * Resets machine.
     *
     * @method reset
     */
    abstract reset(): void;
    /**
     * Clears a current error state, if possible.
     *
     * @method clearError
     */
    abstract clearError(): void;
    /**
     * Move by inc in direction of axis.  If this is called multiple times before a previous move is completed, extra invocations
     * should be ignored.  This is used for real-time control of the machine with an interface.
     *
     * @method realTimeMove
     * @param {Number} axis - Axis number.  0=x, 1=y, etc.
     * @param {Number} inc - Increment to move axis by.
     */
    abstract realTimeMove(axis: number, inc: number): void;
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
    abstract move(pos: (number | false)[], feed?: number): Promise<void>;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        return {
            ready: this.ready,
            axisLabels: this.axisLabels,
            usedAxes: this.usedAxes,
            axisMaxFeeds: this.axisMaxFeeds,
            axisMaxTravel: this.axisMaxTravel,
            mpos: this.mpos,
            pos: this.getPos(),
            mposOffset: this.getCoordOffsets(),
            activeCoordSys: this.activeCoordSys,
            offset: this.offset,
            offsetEnabled: this.offsetEnabled,
            storedPositions: this.storedPositions,
            homed: this.homed,
            held: this.held,
            units: this.units,
            feed: this.feed,
            incremental: this.incremental,
            moving: this.moving,
            coolant: this.coolant,
            spindle: this.spindle,
            spindleDirection: this.spindleDirection,
            spindleSpeed: this.spindleSpeed || 0,
            spindleSpeedMax: this.spindleSpeedMax,
            spindleSpeedMin: this.spindleSpeedMin,            
            line: this.line,
            error: this.error,
            errorData: this.errorData,
            programRunning: this.programRunning,
            capabilities: {
                variableSpindle:false, // 'V': 'variableSpindle',
                mistCoolant: false, //'M': 'mistCoolant',
                floodCoolant: false,
                coreXY: false, // 'C': 'coreXY',
                homeForce: false,
                parking: false,
                homing: false, 
                homingSingleAxis:false, //'H': 'homingSingleAxis', $HX $HY $HZ
                startUpHomeLock: false, // 'L': 'powerUpLockWithoutHoming'
                toolchange:false
            },
            lineCounter: this.lineCounter,
            hasMovedToAxes: this.hasMovedToAxes,
            countM6: this.countM6,
            coordSysOffsets: this.coordSysOffsets,
            countT: this.countT,
            seenWordSet: this.seenWordSet,
            totalTime: this.totalTime,
            homeDirection: this.homeDirection,
            tool: this.tool,
            toolOffset: this.toolOffset,
        } as ControllerStatus;
    }
    listUsedAxisNumbers() {
        const ret = [];
        for (let axisNum = 0; axisNum < this.usedAxes.length; axisNum++) {
            if (this.usedAxes[axisNum])
                ret.push(axisNum);
        }
        return ret;
    }
    listUsedAxisLabels() {
        const ret = [];
        for (let axisNum = 0; axisNum < this.usedAxes.length; axisNum++) {
            if (this.usedAxes[axisNum]) {
                ret.push(this.axisLabels[axisNum]);
            }
        }
        return ret;
    }
}
