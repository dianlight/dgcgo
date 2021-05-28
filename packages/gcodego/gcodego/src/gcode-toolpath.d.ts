/** Declaration file generated by dts-gen */
declare module 'gcode-toolpath' {
    //import { Stream } from "serialport"
    import EventEmitter from 'events';
    import Stream from 'stream'


    export type LoadEventData = {
        line: string,
        words: { 0: string, 1: number }[]
    }

    export type Modal = {
        // Moton Mode
        // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
        motion?: 'G0' | 'G1' | 'G2' | 'G3' | 'G38.2' | 'G38.3' | 'G38.4' | 'G38.5' | 'G80',

        // Coordinate System Select
        // G54, G55, G56, G57, G58, G59
        wcs?: 'G54' | 'G55' | 'G56' | 'G57' | 'G58' | 'G59',

        // Plane Select
        // G17: XY-plane, G18: ZX-plane, G19: YZ-plane
        plane?: 'G17' | 'G18' | 'G19',

        // Units Mode
        // G20: Inches, G21: Millimeters
        units?: 'G20' | 'G21',

        // Distance Mode
        // G90: Absolute, G91: Relative
        distance?: 'G90' | 'G91',

        // Arc IJK distance mode
        arc?: 'G91.1',

        // Feed Rate Mode
        // G93: Inverse time mode, G94: Units per minute mode, G95: Units per rev mode
        feedrate?: 'G93' | 'G94' | 'G95',

        // Cutter Radius Compensation
        cutter?: 'G40',

        // Tool Length Offset
        // G43.1, G49
        tlo?: 'G43.1' | 'G49',

        // Program Mode
        // M0, M1, M2, M30
        program?: 'M0' | 'M1' | 'M2' | 'M30',

        // Spingle State
        // M3, M4, M5
        spindle?: 'M3' | 'M4' | 'M5',

        // Coolant State
        // M7, M8, M9
        coolant?: 'M9' | 'M7' | 'M8' | 'M7,M8' | 'M9',

        // Tool Select
        tool?: number
    }

    export type Position = {
        x: number,
        y: number,
        z: number
    }

    export type Options = {
        position?: Position | number[],
        modal?: Modal,
        addLine: (modal: Modal, start: Position, end: Position) => void,
        addArcCurve: (modal: Modal, start: Position, end: Position, center: Position) => void,
    }

    export class Toolpath {

        constructor(options: Options);

        isAbsoluteDistance(): boolean;

        isImperialUnits(): boolean;

        isMetricUnits(): boolean;

        isRelativeDistance(): boolean;

        isXYPlane(): boolean;

        isYZPlane(): boolean;

        isZXPlane(): boolean;

        setModal(modal: Modal): Modal;

        setPosition(position: Position): void;

        translateI(i: number): number;

        translateJ(j: number): number;

        translateK(k: number): number;

        translateR(r: number): number;

        translateX(x?: number, relative?: number): number;

        translateY(y?: number, relative?: number): number;

        translateZ(z?: number, relative?: number): number;

        loadFromFile(file: string, callback: (err: never, data: string) => void): EventEmitter;

        loadFromFileSync(file: string, callback: (err: never, data: string) => void): never[];

        loadFromStream(data: Stream, callback: (err: never, data: string) => void): EventEmitter;

        loadFromString(data: string, callback: (err: never, data: string) => void): EventEmitter;
    
        loadFromStringSync(data: string, callback: (err: never, data: string) => void): never[];
    }

    export default Toolpath;
}

