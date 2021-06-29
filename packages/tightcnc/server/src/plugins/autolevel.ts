import  cross from 'cross';
import  Operation from '../server/operation';
import { errRegistry } from '../server/errRegistry';
import  objtools from'objtools';
import { kdTree } from 'kd-tree-javascript';
import fs from 'fs';
import { GcodeProcessor, GcodeProcessorLifeCycle, GcodeProcessorOptions } from '../server/new-gcode-processor/GcodeProcessor';
import  GcodeVM  from '../server/new-gcode-processor/GcodeVM'
import { MoveSplitter } from './move-splitter';
import TightCNCServer from '../server/tightcnc-server';
import { JSONSchema7 } from 'json-schema';
import GcodeLine from '../server/new-gcode-processor/GcodeLine';
import { UISchemaElement } from '@jsonforms/core'


export class SurfaceLevelMap {

    pointList: number[][]
    kdtree: kdTree<number[]>

    constructor(points:number[][]) {
        this.pointList = points.slice(); // An array of [x, y, z] points where the z is the probed height
        const dist = (a:number[], b:number[]) => {
            return Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2);
        };
        this.kdtree = new kdTree(points, dist, [0, 1]);
    }
    addPoint(point:number[]) {
        this.pointList.push(point);
        this.kdtree.insert(point);
    }
    getPoints():number[][] {
        return this.pointList;
    }
    // Given a point [ x, y ], predicts the Z of that point based on the known surface level map.  If data
    // is insufficient to predict the Z, null is returned.
    predictZ(point:number[]) {
        if (!this.pointList.length)
            return null;
        // Check for exact hit
        let theNearest = this.getNearestPoints(point, 1);
        if (theNearest[0][0] === point[0] && theNearest[0][1] === point[1])
            return theNearest[0][2];
        // Predict based on plane of 3 nearest points
        if (this.pointList.length >= 3) {
            let nps = this.getNearest3PlanePoints(point);
            if (nps)
                return this._planeZAtPoint(point, nps[0], nps[1]);
        }
        else if (this.pointList.length < 2) {
            return null;
        }
        // There are no suitable plane-defining points.  But it's possible we might still be able to
        // predict the Z of point ifs x,y falls along the line of known points.
        let nearest2 = this.getNearestPoints(point, 2);
        let zdiff = nearest2[1][2] - nearest2[0][2];
        let ydiff = nearest2[1][1] - nearest2[0][1];
        let xdiff = nearest2[1][0] - nearest2[0][0];
        if (xdiff === 0) {
            // line is parallel to Y axis; handle separately to avoid divide by 0
            if (point[0] !== nearest2[0][0] || ydiff === 0) {
                // point not on line
                return null;
            }
            let z = zdiff * (point[1] - nearest2[0][1]) / ydiff + nearest2[0][2];
            if (z === 0)
                z = 0; // check to avoid -0
            return z;
        }
        else {
            let xySlope = ydiff / xdiff;
            let xyIntercept = nearest2[0][1] - xySlope * nearest2[0][0];
            if (xySlope * point[0] + xyIntercept !== point[1]) {
                // point not on line
                return null;
            }
            let z = zdiff * (point[0] - nearest2[0][0]) / xdiff + nearest2[0][2];
            if (z === 0)
                z = 0; // check to avoid -0
            return z;
        }
    }
    // Returns the n nearest points to the given [x, y], sorted from nearest to farthest
    getNearestPoints(point:number[], n:number = 3):number[][] {
        let results = this.kdtree.nearest(point, n);
        results.sort((a, b) => {
            return a[1] - b[1];
        });
        return results.map((r) => r[0]);
    }
    // Returns the nearest 3 points in XY plane that are not colinear and define a plane that is not orthogonal to the XY plane, or null if no such 3 exist
    // Point is [x, y].  Return value is null or [ pointArray, normalVector ]

    getNearest3PlanePoints(point: number[]):[number[][],number[]]|void {
        // Keep a tally of the closest 2 points, then keep searching for a third that's not colinear with the first two
        let curPoints:number[][]|undefined;
        let vA:number[] = [];
        let crossResult:number[] = [];
        for (let n = 3; n <= this.pointList.length; n++) {
            let results = this.getNearestPoints(point, n);
            if (curPoints) {
                curPoints[2] = results[n - 1];
            }
            else {
                curPoints = results.slice();
                vA = [curPoints[1][0] - curPoints[0][0], curPoints[1][1] - curPoints[0][1], curPoints[1][2] - curPoints[0][2]];
            }
            // Check if orthogonal to XY or colinear
            let vB = [curPoints[2][0] - curPoints[0][0], curPoints[2][1] - curPoints[0][1], curPoints[2][2] - curPoints[0][2]];
            let norm = cross(crossResult, vA, vB);
            if (norm[2] !== 0) {
                // not orthogonal to XY
                if (norm[0] !== 0 || norm[1] !== 0) {
                    // not colinear
                    return [curPoints, norm];
                }
            }
        }
        return
    }
    /*
     * Given 3 points on a plane in the form [ [x1, y1, z1], [x2, y2, z2], [x3, y3, z3] ], and a single 2D point [x0, y0],
     * this returns the Z coordinate of the 2D point on the 3D plane specified by the 3 points.  This returns null in
     * cases that 2 of the plane points are colinear (and do not specify a plane), or the point given cannot fall on that plane.
     */
    _planeZAtPoint(point:number[], planePoints: number[][], norm?:number[]) {
        if (!norm) {
            let vA = [planePoints[1][0] - planePoints[0][0], planePoints[1][1] - planePoints[0][1], planePoints[1][2] - planePoints[0][2]];
            let vB = [planePoints[2][0] - planePoints[0][0], planePoints[2][1] - planePoints[0][1], planePoints[2][2] - planePoints[0][2]];
            norm = cross([], vA, vB);
        }
        if (norm[0] === 0 && norm[1] === 0 && norm[2] === 0)
            return null; // points are colinear
        if (norm[2] === 0)
            return null; // point does not intersect plane
        let d = -(norm[0] * planePoints[0][0] + norm[1] * planePoints[0][1] + norm[2] * planePoints[0][2]);
        let z = (-d - norm[0] * point[0] - norm[1] * point[1]) / norm[2];
        if (z === 0)
            return 0;
        else
            return z; // check to avoid -0
    }
}

let surfaceProbeStatus: {
    state: 'none'|'running'|'complete'|'error'
    resultFilename?: string,
    probePointsX?: number,
    probePointsY?: number,
    spacingX?: number,
    spacingY?: number,
    startPoint?: number[],
    probePoints?: number,
    currentProbePoint?: number,
    percentComplete?: number,
    error?: string    
} = {
    state: 'none'
};

let surfaceProbeResults: {
   bounds: number[][]
   probePointsX:number,
   probePointsY:number,
   spacingX:number,
   spacingY:number,
   minSpacing: number,
   time: string,
   points: number[][]
};

function startProbeSurface(tightcnc: TightCNCServer, options: {
    bounds: number[][],
    probeSpacing: number,
    surfaceMapFilename: string
    clearanceHeight: number,
    autoClearanceMin: number,
    autoClearance?: boolean,
    numProbeSamples?: number,
    probeMinZ: number,
    extraProbeSampleClearance?:number
}) {
    if (surfaceProbeStatus.state === 'running')
        throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Surface probe already running');
    surfaceProbeStatus = { state: 'running' };
    // Calculate number of probe points along X and Y, and actual probe spacing
    let lowerBound = options.bounds[0];
    let upperBound = options.bounds[1];
    let probeAreaSizeX = upperBound[0] - lowerBound[0];
    let probeAreaSizeY = upperBound[1] - lowerBound[1];
    if (probeAreaSizeX <= 0 || probeAreaSizeY <= 0)
        throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Invalid bounds');
    let probePointsX = Math.ceil(probeAreaSizeX / options.probeSpacing) + 1;
    let probePointsY = Math.ceil(probeAreaSizeY / options.probeSpacing) + 1;
    if (probePointsX < 2)
        probePointsX = 2;
    if (probePointsY < 2)
        probePointsY = 2;
    let spacingX = probeAreaSizeX / (probePointsX - 1);
    let spacingY = probeAreaSizeY / (probePointsY - 1);
    surfaceProbeStatus.resultFilename = options.surfaceMapFilename;
    surfaceProbeStatus.probePointsX = probePointsX;
    surfaceProbeStatus.probePointsY = probePointsY;
    surfaceProbeStatus.spacingX = spacingX;
    surfaceProbeStatus.spacingY = spacingY;
    let startPoint = [lowerBound[0], lowerBound[1]];
    surfaceProbeStatus.startPoint = startPoint;
    surfaceProbeStatus.probePoints = probePointsX * probePointsY;
    surfaceProbeStatus.currentProbePoint = 0;
    surfaceProbeStatus.percentComplete = 0;

    const sendMove = (x?:number, y?:number, z?:number) => {
        let gcode = 'G0';
        if (typeof x === 'number')
            gcode += ' X' + x.toFixed(3);
        if (typeof y === 'number')
            gcode += ' Y' + y.toFixed(3);
        if (typeof z === 'number')
            gcode += ' Z' + z.toFixed(3);
        tightcnc.controller?.send(gcode);
    };

    const runProbeSurface = async () => {
        let slm = new SurfaceLevelMap([]);
        // Move to above starting point
        sendMove(undefined, undefined, options.clearanceHeight);
        sendMove(startPoint[0], startPoint[1], undefined);
        let currentZ = options.clearanceHeight;
        // Loop through each point
        for (let pointNum = 0; pointNum < probePointsX * probePointsY; pointNum++) {
            surfaceProbeStatus.currentProbePoint = pointNum;
            surfaceProbeStatus.percentComplete = pointNum / (probePointsX * probePointsY) * 100;
            // Calculate the point number X and point number Y in such a way to move the machine in a "zig zag" pattern
            let pointNumX = Math.floor(pointNum / probePointsY);
            let pointNumY = pointNum - pointNumX * probePointsY;
            if (pointNumX % 2 === 1)
                pointNumY = probePointsY - 1 - pointNumY;
            let pointPosX = pointNumX * spacingX + startPoint[0];
            let pointPosY = pointNumY * spacingY + startPoint[1];
            // Calculate the clearance height to get to this point.  If autoClearance is disabled, this is just the predefined
            // clearance.  For autoClearance, the height is determined by predicting the height of the next point and adding autoClearanceMin.
            let clearanceZ = options.clearanceHeight;
            if (options.autoClearance && pointNum >= 2) {
                // Try to predict the z of the next probe point based on existing probe data, and use a smaller clearance to that
                let predictedZ = slm.predictZ([pointPosX, pointPosY]);
                if (typeof predictedZ === 'number')
                    clearanceZ = predictedZ + options.autoClearanceMin;
            }
            // Move to above the next point
            if (clearanceZ > currentZ)
                sendMove(undefined, undefined, clearanceZ);
            sendMove(pointPosX, pointPosY, undefined);
            if (clearanceZ < currentZ)
                sendMove(undefined, undefined, clearanceZ);
            // Probe down towards the point the requisite number of times
            let numProbes = options.numProbeSamples || 1;
            let probesResults = [];
            for (let i = 0; i < numProbes; i++) {
                let tripPos = await tightcnc.controller?.probe([false, false, options.probeMinZ]);
                let tripZ = tripPos![2];
                probesResults.push(tripZ);
                if (i + 1 < numProbes) {
                    // move up small clearance for next sample
                    let smallClearanceZ = clearanceZ;
                    if (options.extraProbeSampleClearance)
                        smallClearanceZ = tripZ + options.extraProbeSampleClearance;
                    sendMove(undefined, undefined, smallClearanceZ);
                }
            }
            // Average together the probe results for each sample
            let tripZ = 0;
            for (let r of probesResults)
                tripZ += r;
            tripZ /= probesResults.length;
            // Add point to list of points
            slm.addPoint([pointPosX, pointPosY, tripZ]);
            // Move up to minimum clearance
            currentZ = options.autoClearance ? (tripZ + options.autoClearanceMin) : options.clearanceHeight;
            sendMove(undefined, undefined, currentZ);
        }
        // Probing complete.  Move back to full clearance, and the lower bound XY
        sendMove(undefined, undefined, options.clearanceHeight);
        sendMove(lowerBound[0], lowerBound[1], undefined);
        // Save the probing results
        surfaceProbeResults = {
            bounds: options.bounds,
            probePointsX,
            probePointsY,
            spacingX,
            spacingY,
            minSpacing: Math.min(spacingX, spacingY),
            time: new Date().toISOString(),
            points: slm.getPoints()
        };
        if (options.surfaceMapFilename) {
            await new Promise((resolve, reject) => {
                fs.writeFile(options.surfaceMapFilename, JSON.stringify(surfaceProbeResults, null, 2), (err) => {
                    if (err)
                        reject(errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error saving probe result file').withMetadata(err));
                    else
                        resolve(surfaceProbeResults);
                });
            });
        }
    };
    // Run the actual process asynchronously, reporting progress via status updates
    runProbeSurface()
        .then(() => {
        surfaceProbeStatus.state = 'complete';
        surfaceProbeStatus.currentProbePoint = probePointsX * probePointsY - 1;
        surfaceProbeStatus.percentComplete = 100;
    })
        .catch((err) => {
        surfaceProbeStatus.state = 'error';
        surfaceProbeStatus.error = err.toObject ? err.toObject() : ('' + err);
    });
}
function getProbeStatus() {
    if (surfaceProbeStatus.state === 'none')
        return null;
    return surfaceProbeStatus;
}
class OpProbeSurface extends Operation {

    constructor(tightcnc: TightCNCServer) {
        super(tightcnc);
    }

    async _getBounds(params: {
        bounds: true,
        gcodeFilename: string
    }) {
        if (params.bounds)
            return params.bounds;
        if (!params.gcodeFilename)
            throw errRegistry.newError('INTERNAL_ERROR','BAD_REQUEST').formatMessage('Must supply either bounds or gcodeFilename');
        let dryRunResults = await this.tightcnc!.jobManager?.dryRunJob({ filename: params.gcodeFilename });
        if (dryRunResults) {
            let bounds = objtools.getPath(dryRunResults, 'gcodeProcessors.final-job-vm.bounds');
            if (!bounds)
                throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Could not determine bounds from gcode file');
            return bounds;
        } else throw errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Could not determine bounds from gcode file - no dryRunResults');
    }

    async run(params: {
        bounds: true,
        gcodeFilename: string
    }) {
        let options = objtools.deepCopy(params);
        if (options.gcodeFilename)
            options.gcodeFilename = this.tightcnc.getFilename(options.gcodeFilename, 'data');
        if (options.surfaceMapFilename)
            options.surfaceMapFilename = this.tightcnc.getFilename(options.surfaceMapFilename, 'data');
        options.bounds = await this._getBounds(params);
        startProbeSurface(this.tightcnc, options);
        return surfaceProbeStatus;
    }
    
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/probeSurface",
            type: 'object',
            properties: {
                surfaceMapFilename: {
                    type: 'string',
                    description: 'Filename to save the resulting surface map to'
                },
                bounds: {
                    type: 'array',
                    items: {
                        type: 'array',
                        items: {
                          type: 'number'  
                        } ,
                        /*
                        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                        validate(val) {
                            if (val.length < 2)
                                throw new commonSchema.FieldError('invalid', 'Bounds points must have at least 2 coordinates');
                        }
                        */
                    },
                    /*
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    validate(val) {
                        if (val.length !== 2)
                            throw new commonSchema.FieldError('invalid', 'Bounds must have 2 elements');
                    },
                    */
                    description: 'Bounds to run surface probe on'
                },
                gcodeFilename: {
                    type: 'string',
                    description: 'Can be supplied instead of bounds to automatically determine bounds'
                },
                probeSpacing: {
                    type: 'number',
                    default: this.config?.defaultOptions.probeSpacing,
                    description: 'Maximum grid separation between probe points'
                },
                probeFeed: {
                    type: 'number',
                    default: this.config?.defaultOptions.probeFeed,
                    description: 'Feed rate for probing'
                },
                clearanceHeight: {
                    type: 'number',
                    default: this.config?.defaultOptions.clearanceHeight,
                    description: 'Clearance Z for moving across surface'
                },
                autoClearance: {
                    type: 'boolean',
                    default: this.config?.defaultOptions.autoClearance,
                    description: 'Whether to automatically adjust clearance height based on known probe points to optimize speed'
                },
                autoClearanceMin: {
                    type: 'number',
                    default: this.config?.defaultOptions.autoClearanceMin,
                    description: 'Minimum amount of clearance when using autoClearance'
                },
                probeMinZ: {
                    type: 'number',
                    default: this.config?.defaultOptions.probeMinZ,
                    description: 'Minimum Z value to probe toward.  Error if this Z is reached without the probe tripping.'
                },
                numProbeSamples: {
                    type: 'number',
                    default: this.config?.defaultOptions.numProbeSamples,
                    description: 'Number of times to probe for each point'
                },
                extraProbeSampleClearance: {
                    type: 'number',
                    default: this.config?.defaultOptions.extraProbeSampleClearance,
                    description: 'When probing multiple times per point, the clearance to use for all but the first probe'
                }
            }
        } as JSONSchema7
    }
}

interface AutolevelGcodeProcessorOptions extends GcodeProcessorOptions {
    surfaceMapFilename: string
}
class AutolevelGcodeProcessor extends GcodeProcessor {
    surfaceMapFilename: string;
    vm: GcodeVM;
    surfaceMap?: SurfaceLevelMap;
    surfaceMapData?: {
        points: number[][]
        minSpacing: number
    }

    constructor(options:AutolevelGcodeProcessorOptions) {
        super(options, 'autolevel', true);
        this.surfaceMapFilename = options.surfaceMapFilename;
        this.vm = new GcodeVM({} /*options*/);
    }

    static override getOptionSchema(): JSONSchema7 {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            $id: "/autolevel",
            properties: {
                "surfaceMapFilename": {
                    type: "string",
                    description: "Filename for surface data",
                },
            },
            required: ['surfaceMapFilename']
        } as JSONSchema7
    }

    static override getOptionUISchema(): UISchemaElement {
        return {
                type: 'HorizontalLayout',
                elements: [
                    {
                        type: 'Control',
                        label: 'Filename for surface data',
                        scope: '#/properties/surfaceMapFilename'
                    }
                ]
            } as UISchemaElement
    }

    static override getLifeCicle(): GcodeProcessorLifeCycle {
        return 'optional-ui'
    }



    _loadSurfaceMap() {
        if (this.surfaceMap)
            return;
        if (this.tightcnc)
            this.surfaceMapFilename = this.tightcnc.getFilename(this.surfaceMapFilename, 'data');
        return new Promise<void>((resolve, reject) => {
            fs.readFile(this.surfaceMapFilename, (err, data) => {
                if (err)
                    return reject(errRegistry.newError('INTERNAL_ERROR','GENERIC').formatMessage('Error loading surface map').withMetadata(err));
                this.surfaceMapData = JSON.parse(data.toString('utf8'));
                this.surfaceMap = new SurfaceLevelMap(this.surfaceMapData!.points);
                resolve();
            });
        });
    }
    override async addToChain(chain:GcodeProcessor[]) {
        await this._loadSurfaceMap();
        chain.push(new MoveSplitter({
            tightcnc: this.tightcnc,
            maxMoveLength: this.surfaceMapData!.minSpacing
        }));
        super.addToChain(chain);
    }

    override async initProcessor() {
        await this._loadSurfaceMap();
    }

    override processGcode(gline:GcodeLine) {
        let startVMState = objtools.deepCopy(this.vm.getState());
        // Run the line through the gcode VM
        let { isMotion, changedCoordOffsets, motionCode } = this.vm.runGcodeLine(gline);
        let endVMState = this.vm.getState();
        // Make sure the line represents motion
        if (!isMotion)
            return gline;
        // If anything regarding changing coordinate systems has changed, ignore the line
        if (changedCoordOffsets || gline.has('G53'))
            return gline;
        // Make sure we're not in incremental mode
        if (endVMState.incremental)
            return gline; // incremental mode not supported
        // Make sure the motion mode is one of the supported motion modes
        if (motionCode !== 'G0' && motionCode !== 'G1' && motionCode !== 'G2' && motionCode !== 'G3')
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('Motion code ' + motionCode + ' not supported for autolevel');
        // Get the Z value for the X and Y ending position
        let toXY = [endVMState.pos[0], endVMState.pos[1]];
        let zOffset = this.surfaceMap?.predictZ(toXY);
        if (!zOffset || zOffset === null)
            return gline;
        let newZ = endVMState.pos[2] + zOffset;
        // Set the new Z value
        if (newZ !== gline.get('Z')) {
            gline.set('Z', newZ);
            gline.addComment('al');
        }
        return gline;
    }
}

/*
class AutolevelConsoleUIJobOption extends JobOption {

    alOptions: {
        surfaceMapFile?: any
        surfaceMap?:any
        enabled: boolean
    }

    constructor(consoleui: ConsoleUI) {
        super(consoleui);
        this.alOptions = {
            enabled: false
        };
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'params' implicitly has an 'any' type.
    async _runProbeSequence(params) {
        let container = this.consoleui.mainPane;
        let initStatus = await this.consoleui.runWithWait(async () => {
            return await this.consoleui.client?.op('probeSurface', params);
        });
        let probeInfoBox = blessed.box({
            width: '50%',
            height: '40%',
            top: 'center',
            left: 'center',
            border: { type: 'line' },
            keyable: true,
            align: 'center',
            valign: 'middle',
            content: ''
        });
        container!.append(probeInfoBox);
        probeInfoBox.focus();
        let origGrabKeys = this.consoleui!.screen!.grabKeys;
        this.consoleui!.screen!.grabKeys = true;
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'probeStatus' implicitly has an 'any' ty... Remove this comment to see the full error message
        const updateProbeInfo = (probeStatus) => {
            probeInfoBox.content = 'Probing surface ...\nState: ' + probeStatus.state + '\nPoint ' + (probeStatus.currentProbePoint + 1) + '/' + probeStatus.probePoints + ' (' + Math.floor(probeStatus.percentComplete) + '%)';
            if (probeStatus.state === 'error' && probeStatus.error)
                probeInfoBox.content += '\nError: ' + probeStatus.error;
            this.consoleui.render();
        };
        updateProbeInfo(initStatus);
        let finished = initStatus.state !== 'running';
        let startedRunning = false;
        // @ts-expect-error ts-migrate(7034) FIXME: Variable 'retVal' implicitly has type 'any' in som... Remove this comment to see the full error message
        let retVal = null;
        return await new Promise((resolve, reject) => {
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'status' implicitly has an 'any' type.
            const statusUpdateHandler = (status) => {
                if (!status.probeSurface)
                    return;
                updateProbeInfo(status.probeSurface);
                if (status.probeSurface.state === 'running')
                    startedRunning = true;
                if (!finished && startedRunning && status.probeSurface.state !== 'running') {
                    finished = true;
                    this.consoleui.popHintOverrides();
                    this.consoleui.pushHintOverrides([['Esc', 'Close']]);
                    if (status.probeSurface.state === 'complete') {
                        retVal = params.surfaceMapFilename;
                    }
                }
            };
            const cleanup = () => {
                this.consoleui.removeListener('statusUpdate', statusUpdateHandler);
                container!.remove(probeInfoBox);
                this.consoleui.popHintOverrides();
                this.consoleui.screen!.grabKeys = origGrabKeys;
            };
            this.consoleui.on('statusUpdate', statusUpdateHandler);
            this.consoleui.pushHintOverrides([['Esc', 'Cancel']]);
            probeInfoBox.key(['escape'], () => {
                if (!finished) {
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
                    this.consoleui.client.op('cancel', {}).catch((err) => this.consoleui.clientError(err));
                }
                cleanup();
                // @ts-expect-error ts-migrate(7005) FIXME: Variable 'retVal' implicitly has an 'any' type.
                resolve(retVal);
            });
        });
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _chooseBounds(container, def) {
        let lowerDefault = (def && def[0]) || [0, 0];
        let upperDefault = (def && def[1]) || [0, 0];
        let formSchema = {
            type: 'object',
            label: 'Surface Map Probe Bounds',
            properties: {
                fromJob: {
                    type: 'mixed',
                    label: '[From Job]',
                    // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
                    actionFn: async (info) => {
                        if (!this.newJobMode.jobFilename && !this.newJobMode.jobMacro)
                            throw new Error('No job filename configured');
                        let dryRunResults = await this.consoleui.runWithWait(async () => {
                            return await this.consoleui.client?.op('jobDryRun', this.newJobMode.makeJobOptionsObj());
                        }, 'Processing job ...');
                        let bounds = objtools.getPath(dryRunResults, 'gcodeProcessors.final-job-vm.bounds');
                        if (bounds) {
                            info.obj.lower = bounds[0].slice(0, 2);
                            info.obj.upper = bounds[1].slice(0, 2);
                        }
                    }
                },
                lower: {
                    type: [Number],
                    label: 'Lower Bound',
                    default: lowerDefault,
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    shortDisplayLabel: (val) => Array.isArray(val) ? val.slice(0, 2).join(',') : null,
                    isCoordinates: true,
                    coordinatesLength: 2
                },
                upper: {
                    type: [Number],
                    label: 'Upper Bound',
                    default: upperDefault,
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    shortDisplayLabel: (val) => Array.isArray(val) ? val.slice(0, 2).join(',') : null,
                    isCoordinates: true,
                    coordinatesLength: 2
                }
            }
        };
        let form = new ListForm(this.consoleui);
        let results = await form.showEditor(container, formSchema,{});
        if (results && results.lower && results.upper) {
            return [results.lower, results.upper];
        }
        else {
            return null;
        }
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _newSurfaceMap(container) {
        let formSchema = {
            type: 'object',
            label: 'New Surface Map',
            doneLabel: '[Run Surface Map]',
            properties: {
                bounds: {
                    type: 'array',
                    elements: [Number],
                    label: 'Select Bounds',
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
                    editFn: async (container) => {
                        // @ts-expect-error ts-migrate(2554) FIXME: Expected 2 arguments, but got 1.
                        let r = await this._chooseBounds(container);
                        return [r, !r];
                    },
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    shortDisplayLabel: (val) => val ? val.map((a) => a.slice(0, 2).join(',')).join(' - ') : null,
                    required: true
                },
                surfaceMapFilename: {
                    type: 'string',
                    label: 'Save As',
                    default: 'surfacemap_' + moment().format('YYYY-MM-DD_HH-mm') + '.smap.json',
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'v' implicitly has an 'any' type.
                    normalize: (v) => {
                        if (!/.*\.smap\.json$/.test(v))
                            v += '.smap.json';
                        return v;
                    },
                    required: true
                },
                probeSpacing: {
                    type: Number,
                    label: 'Probe Spacing',
                    default: 10,
                    description: 'Maximum grid separation between probe points'
                },
                probeFeed: {
                    type: Number,
                    label: 'Probe Feedrate',
                    default: 25,
                    description: 'Feed rate for probing'
                },
                clearanceHeight: {
                    type: Number,
                    label: 'Clearance Height',
                    default: 2,
                    description: 'Clearance Z for moving across surface'
                },
                autoClearance: {
                    type: Boolean,
                    label: 'Enable Auto-Clearance',
                    default: true,
                    description: 'Whether to automatically adjust clearance height based on known probe points to optimize speed'
                },
                autoClearanceMin: {
                    type: Number,
                    label: 'Auto-Clearance Min Clearance',
                    default: 0.5,
                    description: 'Minimum amount of clearance when using autoClearance'
                },
                probeMinZ: {
                    type: Number,
                    label: 'Probe Z Cutoff',
                    default: -2,
                    description: 'Minimum Z value to probe toward.  Error if this Z is reached without the probe tripping.'
                },
                numProbeSamples: {
                    type: Number,
                    label: 'Samples per point',
                    default: 3,
                    description: 'Number of samples to take per probe point'
                },
                extraProbeSampleClearance: {
                    type: Number,
                    label: 'Multi-sample clearance',
                    default: 0.4,
                    description: 'Amount of clearance to use for subsequent probe samples on a point'
                }
            }
        };
        let form = new ListForm(this.consoleui);
        let formResults = await form.showEditor(container, formSchema, undefined, { returnDefaultOnCancel: false });
        if (!formResults)
            return null;
        commonSchema.createSchema(formSchema).normalize(formResults);
        let confirmed = await this.consoleui.showConfirm('Press Enter to start probing.', { okLabel: 'Start' }, container);
        if (!confirmed)
            return null;
        // TODO: add ability to feed hold and cancel
        //await this.consoleui.runWithWait(async () => {
        //	return await this.consoleui.client.op('probeSurface', formResults);
        //}, 'Probing ...');
        return await this._runProbeSequence(formResults);
        //return formResults.surfaceMapFilename;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _chooseSurfaceMap(container) {
        let files = await this.consoleui.runWithWait(() => this.consoleui.client?.op('listFiles'));
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'f' implicitly has an 'any' type.
        files = files.filter((f) => f.type !== 'gcode').map((f) => f.name);
        let formSchema = {
            label: 'AutoLevel Surface Map',
            type: 'string',
            enum: ['[Create New]'].concat(files)
        };
        let form = new ListForm(this.consoleui);
        let file = await form.showEditor(container, formSchema, this.alOptions.surfaceMapFile);
        if (!file) {
            return this.alOptions.surfaceMapFile;
        }
        else if (file === '[Create New]') {
            let r = await this._newSurfaceMap(container);
            return r ? r : this.alOptions.surfaceMapFile;
        }
        else {
            return file;
        }
    }
    // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
    async _optionsForm(container) {
        let formSchema = {
            label: 'AutoLevel Settings',
            type: 'object',
            properties: {
                enabled: {
                    type: 'boolean',
                    default: false,
                    label: 'AutoLevel Enabled'
                },
                surfaceMap: {
                    type: 'string',
                    label: 'Surface Map',
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
                    editFn: async (container) => {
                        let r = await this._chooseSurfaceMap(container);
                        return [r, !r];
                    }
                }
            }
        };
        let form = new ListForm(this.consoleui);
        let r = await form.showEditor(null, formSchema, this.alOptions);
        if (r !== null)
            this.alOptions = r;
        this.newJobMode.updateJobInfoText();
    }
    override async optionSelected() {
        // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 0.
        await this._optionsForm();
    }
    override getDisplayString() {
        if (this.alOptions.enabled && this.alOptions.surfaceMap)
            return 'AutoLevel: ' + this.alOptions.surfaceMap;
        else
            return null;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'obj' implicitly has an 'any' type.
    addToJobOptions(obj) {
        if (this.alOptions.enabled && this.alOptions.surfaceMap) {
            if (!obj.gcodeProcessors)
                obj.gcodeProcessors = [];
            obj.gcodeProcessors.push({
                name: 'autolevel',
                options: {
                    surfaceMapFilename: this.alOptions.surfaceMap
                }
            });
        }
    }
}
*/

export function registerServerComponents(tightcnc:TightCNCServer) {
    tightcnc.registerGcodeProcessor(/*'autolevel',*/ AutolevelGcodeProcessor);
    tightcnc.registerOperation(/*'probeSurface',*/ OpProbeSurface);
    tightcnc.on('statusRequest', (status) => {
        let probeStatus = getProbeStatus();
        if (probeStatus) {
            status.probeSurface = probeStatus;
        }
    });
};
/*
// @ts-expect-error ts-migrate(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports.registerConsoleUIComponents = function (consoleui) {
    consoleui.registerJobOption('AutoLevel', AutolevelConsoleUIJobOption);
};
*/
