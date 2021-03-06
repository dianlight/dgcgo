import { GcodeVM, GcodeLine, GcodeProcessor, GcodeProcessorLifeCycle, GcodeProcessorOptions } from '@dianlight/tightcnc-core'
//import  objtools from 'objtools';
import { AbstractServer } from '@dianlight/tightcnc-core';
import { JSONSchema7 } from 'json-schema'
import { UISchemaElement } from '@jsonforms/core'
import * as _ from 'lodash';

interface MoveSplitterProcessorOptions extends GcodeProcessorOptions {
    maxMoveLength: number
}

/**
 * This gcode processor will split long linear moves into a series of shorter ones.
 *
 * @class MoveSplitter
 * @constructor
 * @param {Object} options
 *   @param {Number} options.maxMoveLength=10
 */
export class MoveSplitter extends GcodeProcessor {


    maxMoveLength: number
    vm: GcodeVM

    constructor(options:MoveSplitterProcessorOptions) {
        super(options, 'movesplitter', true);
        this.maxMoveLength = options.maxMoveLength || 10;
        this.vm = new GcodeVM(options);
    }

    static override getOptionSchema(): JSONSchema7 {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            $id: '/moves-plitter',
            properties: {
                'maxMoveLength': {
                    type: 'number',
                    description: 'Max allowed move lenght before cut',
                    default: 10,
                    min: 0.1
                },
            },
            required: ['maxMoveLength']
        } as JSONSchema7
    }

    override initProcessor(): Promise<void> {
        return Promise.resolve();
    }
    override preprocessInputGcode(this: void): void | ReadableStream<unknown> {
        // No action
    }
    override flushGcode(): void | GcodeLine | GcodeLine[] | Promise<GcodeLine | GcodeLine[]> {
        // No action
    }


    static override getOptionUISchema(): UISchemaElement {
        return {
                type: 'HorizontalLayout',
                elements: [
                    {
                        type: 'Control',
                        label: 'Max Move Length',
                        scope: '#/properties/maxMoveLength'
                    }
                ]
            } as UISchemaElement
    }

    static override getLifeCicle(): GcodeProcessorLifeCycle {
        return 'server-only'
    }

    override processGcode(gline:GcodeLine) {
        const startVMState = _.cloneDeep(this.vm.getState());
        // Run the line through the gcode VM
        const { isMotion, changedCoordOffsets, motionCode } = this.vm.runGcodeLine(gline);
        // Make sure the line represents motion
        if (!isMotion)
            return gline;
        // If anything regarding changing coordinate systems has changed, ignore the line
        if (changedCoordOffsets || gline.has('G53'))
            return gline;
        // Get position diffs for all changed axes
        const endVMState = this.vm.getState();
        const axisDiffs = [];
        let numChangedAxes = 0;
        for (let axisNum = 0; axisNum < startVMState.pos.length; axisNum++) {
            if (startVMState.pos[axisNum] !== endVMState.pos[axisNum]) {
                // Moved on this axis
                // If we've never gotten definitive positions for this axis before, ignore the line
                if (!startVMState.hasMovedToAxes[axisNum])
                    return gline;
                axisDiffs.push(endVMState.pos[axisNum] - startVMState.pos[axisNum]);
                numChangedAxes++;
            }
            else {
                axisDiffs.push(0);
            }
        }
        if (!numChangedAxes)
            return gline; // nothing actually moved
        // Make sure we're not in incremental mode
        if (endVMState.incremental)
            return gline; // incremental mode not supported
        // Make sure the motion mode is one of the supported motion modes
        if (motionCode !== 'G0' && motionCode !== 'G1')
            return gline;
        // Calculate the distance moved and check if it's above the threshold
        let dist = 0;
        for (const p of axisDiffs) {
            dist += p * p;
        }
        dist = Math.sqrt(dist);
        if (dist <= this.maxMoveLength)
            return gline;
        // This is a move that needs to be split up.
        // Output a version of the original gline without any of the coordinates specified, to set any other modes it may be setting (including feed)
        for (let i = 0; i < axisDiffs.length; i++) {
            gline.set(endVMState.axisLabels[i]);
        }
        // don't send if line is now empty, or only contains the motion gcode
        if (gline.words && ( gline.words.length > 1 || (gline.words.length === 1 && `G${gline.get<number>('G')||9}` !== motionCode) || gline.comment)) {
            gline.addComment('sp');
            this.pushGcode(gline);
        }
        else {
            const l = new GcodeLine();
            l.addComment('sp');
            this.push(l);
        }
        // Output movement segments
        const numMoves = Math.ceil(dist / this.maxMoveLength);
        for (let i = 0; i < numMoves; i++) {
            const newgline = new GcodeLine(motionCode);
            newgline.addComment('sp+');
            for (let axisNum = 0; axisNum < axisDiffs.length; axisNum++) {
                if (axisDiffs[axisNum]) {
                    const moveAxisDiff = (i + 1) * axisDiffs[axisNum] / numMoves;
                    const moveAxisCoord = startVMState.pos[axisNum] + moveAxisDiff;
                    newgline.set(startVMState.axisLabels[axisNum], moveAxisCoord);
                }
            }
            this.pushGcode(newgline);
        }
        return undefined;
    }
}

export function registerServerComponents(tightcnc: AbstractServer) {
    tightcnc.registerGcodeProcessor(/*'movesplitter',*/ MoveSplitter);
}
