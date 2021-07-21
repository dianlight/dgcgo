
export interface VMState {
    axisLabels: string[];
    coord?: (coords: number[], axis: number | string, value?: number) => number | undefined; // = this.coord.bind(this);
    totalTime: number; // seconds
    bounds?: [(number | null)[], (number | null)[]]; // = [this.zerocoord(null), this.zerocoord(null)]; // min and max points
    mbounds?: [(number | null)[], (number | null)[]]; // = [this.zerocoord(null), this.zerocoord(null)]; // bounds for machine coordinates
    lineCounter: number;
    hasMovedToAxes: boolean[]; // = this.zerocoord(false); // true for each axis that we've moved on, and have a definite position for
    seenWordSet: {
        [key: string]: boolean;
    }; // a mapping from word letters to boolean true if that word has been seen at least once
    tool?: number | undefined;
    countT: number;
    countM6: number;
    feed?: number | undefined;
    motionMode?: 'G0' | 'G1' | 'G2' | 'G3' | undefined;
    arcPlane?: number;
    incremental?: boolean;
    inverseFeed?: boolean;
    units?: 'in' | 'mm';
    spindle?: boolean;
    spindleDirection?: -1 | 1;
    spindleSpeed?: number | undefined;
    coolant?: false | 1 | 2 | 3;
    activeCoordSys?: number | undefined;
    pos: number[];
    mpos: number[];
    coordSysOffsets: number[][];
    offset?: (number | undefined)[];
    offsetEnabled?: boolean;
    storedPositions: number[][];
    line?: number;
    gcodeLine?: string;
    homeDirection?: ('+' | '-')[];

    updateTime?: string;
    [key: string]: unknown;
}
