import  Operation from './operation';
import objtools from 'objtools';
import { errRegistry } from './errRegistry';
import TightCNCServer, { StatusObject } from './tightcnc-server';
import { JSONSchema7 } from 'json-schema';
import { number } from 'yargs';

class OpGetStatus extends Operation {

    async run(params: {
        fields: string[],
        sync?: boolean
    }):Promise<Partial<StatusObject>> {
        if (params.sync) {
            await this.tightcnc.controller?.waitSync();
        }
        let fields = params && params.fields;
        let stat = await this.tightcnc.getStatus();
        if (!fields)
            return stat;
        let ret = {};
        for (let field of fields) {
            let val = objtools.getPath(stat, field);
            if (val !== undefined)
                objtools.setPath(ret, field, val);
        }
        return ret;
    }

    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getStatus",
            type: 'object',
            properties: {
                "fields": {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: 'List of status fields to return.'
                },
                "sync": {
                    type: "boolean",
                    description: 'Whether to wait for machine to stop and all commands to be processed before returning status',
                    default: false                    
                }
            }
         } as JSONSchema7
    }


}
class OpSend extends Operation {    
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/send",
            type: 'object',
            properties: {
                line: {
                    type: "string",
                    description: 'Line of gcode to send'
                },
                wait: {
                    type: "boolean",
                    default: false,
                    description: 'Whether to wait for the line to be received'
                }
            },
            required: [ 'line' ]
        } as JSONSchema7
    }

    async run(params:{line: string, wait?:boolean}) {
        if (params.wait) {
            this.tightcnc.controller?.send(params.line);
            await this.tightcnc.controller?.waitSync();
        }
        else {
            this.tightcnc.controller?.send(params.line);
        }
    }
}
class OpHold extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/hold",
    } as JSONSchema7; }
    run() {
        this.tightcnc.controller?.hold();
    }
}
class OpResume extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/resume"
    } as JSONSchema7; }
    run() {
        this.tightcnc.controller?.resume();
    }
}
class OpCancel extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/cancel",
    } as JSONSchema7; }
    run() {
        this.tightcnc.controller?.cancel();
        this.tightcnc.cancelInput();
    }
}
class OpReset extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/reset",
    }as JSONSchema7; }
    run() {
        this.tightcnc.controller?.reset();
    }
}
class OpClearError extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/clearError",
    }as JSONSchema7; }
    run() {
        this.tightcnc.controller?.clearError();
    }
}
class OpRealTimeMove extends Operation {
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/realTimeMove",
            type: 'object',
            properties: {
                axis: {
                    type: "number",
                    description: 'Axis number to move'
                },
                inc: {
                    type: "number",
                    description: 'Amount to move the axis'
                },
            },
            required: ['axis','inc']
        } as JSONSchema7;
    }
    run(params:{axis:number, inc:number}) {
        this.checkReady();
        this.tightcnc.controller?.realTimeMove(params.axis, params.inc);
    }
}
class OpMove extends Operation {
    
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#", 
            $id: "/move",
            type: 'object',
            properties: {
                pos: {
                    type: 'array',
                    items: {
                        oneOf: [
                            { type: "number" },
                            { type: "boolean"}
                        ]
                    },
                    description: 'Position to move to'
                },
                feed: {
                    type: "number",
                    description: 'Feed rate'
                }
            },
            required: ['pos']
        } as JSONSchema7;
    }
    
    async run(params:{pos:(number|false)[],feed?:number}) {
        this.checkReady();
        await this.tightcnc.controller?.move(params.pos, params.feed);
    }
}
class OpHome extends Operation {
    
    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/home",
            type: 'object',
            properties: {
                axes: {
                    type: 'array',
                    items: {
                        type: "boolean"
                    },
                    description: 'True for each axis to home.  False for axes not to home.'
                }
            }
        } as JSONSchema7;
    }
    
    async run(params:{axes:boolean[]}) {
        this.checkReady();
        await this.tightcnc.controller?.home(params.axes);
    }
}
class OpSetAbsolutePos extends Operation {

    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/setAbsolutePos",
            type: 'object',
            properties: {
                pos: {
                    type: 'array',
                    items: {
                        oneOf: [
                            { type: "number" },
                            { type: "boolean" }
                        ]
                    },
                    description: 'Positions of axes to set (machine coords).  If undefined, 0 is used for all axes.  Elements can also be true (synonym for 0) or false (to ignore that axis).'
                }
            }
        } as JSONSchema7;
    }

    async run(params: {
        pos:(number|boolean)[]
    }) {
        let pos = params.pos;
        await this.tightcnc.controller?.waitSync();
        if (!pos) {
            pos = [];
            for (let axisNum = 0; axisNum < this.tightcnc.controller!.usedAxes.length; axisNum++) {
                if (this.tightcnc.controller!.usedAxes[axisNum]) {
                    pos.push(0);
                }
                else {
                    pos.push(false);
                }
            }
        }
        else {
            for (let axisNum = 0; axisNum < pos.length; axisNum++) {
                if (pos[axisNum] === true)
                    pos[axisNum] = 0;
            }
        }
        let gcode = 'G53 G0';
        if(this.tightcnc.controller) for (let axisNum of this.tightcnc.controller.listUsedAxisNumbers()) {
            let axis = this.tightcnc.controller!.axisLabels[axisNum].toUpperCase();
            if (typeof pos[axisNum] === 'number') {
                gcode += ' ' + axis + pos[axisNum];
            }
        }
        await this.tightcnc.controller?.send(gcode);
        await this.tightcnc.controller?.waitSync();
    }
}
class OpProbe extends Operation {

    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/probe",
            type: 'object',
            properties: {
                pos: {
                    type: 'array',
                    items: {
                        anyOf: [
                            { type: 'number' },
                            { type: 'boolean'}
                        ]
                    },
                    description: 'Position to probe to'
                },
                feed: {
                    type: "number",
                    description: 'Feed rate'
                }
            },
            required: ['pos']
        } as JSONSchema7;
    }

    async run(params: { pos: (number|boolean)[], feed?: number }) {
        this.checkReady();
        return await this.tightcnc.controller?.probe(params.pos, params.feed);
    }
}
class OpSetOrigin extends Operation {

    getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/setOrigin",
            type: "object",
            properties: {
                coordSys: {
                    type: "number",
                    description: 'Coordinate system to set origin for; 0 = G54.  If null, current coord sys is used.'
                },
                pos: {
                    type: 'array',
                    items: {
                        oneOf: [
                            { type: "number" },
                            { type: "boolean"}
                        ]
                    },
                    description: 'Position offsets of new origin.  If null, current position is used.  Elements can also be true (to use current position for that axis) or false (to ignore that axis).'
                }
            }
        } as JSONSchema7
    }
    
    async run(params:{coordSys?:number,pos?:(number|boolean)[]}) {
        let pos = params.pos;
        let posHasBooleans = pos && pos.some((c) => typeof c === 'boolean');
        if (!pos || posHasBooleans || !params.coordSys) {
            await this.tightcnc.controller?.waitSync();
        }
        if (!pos) {
            pos = this.tightcnc.controller!.mpos;
        }
        else {
            for (let axisNum = 0; axisNum < pos.length; axisNum++) {
                if (pos[axisNum] === true)
                    pos[axisNum] = this.tightcnc.controller!.mpos[axisNum];
            }
        }
        let coordSys = params.coordSys || this.tightcnc.controller!.activeCoordSys || 0;
        let gcode = 'G10 L2 P' + (coordSys + 1);
        if(this.tightcnc.controller) for (let axisNum of this.tightcnc.controller.listUsedAxisNumbers()) {
            let axis = this.tightcnc.controller?.axisLabels[axisNum].toUpperCase();
            if (typeof pos[axisNum] === 'number') {
                gcode += ' ' + axis + pos[axisNum];
            }
        }
        await this.tightcnc.controller?.send(gcode);
        await this.tightcnc.controller?.waitSync();
    }
}

class OpWaitSync extends Operation {
    
    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/waitSync",
            type: "null"
        } as JSONSchema7;
    }
    
    override async run() {
        await this.tightcnc.controller?.waitSync();
    }
}
class OpGetLog extends Operation {
    
    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getLog",
            type: "object",
            properties: {
                logType: {
                    type: "string",
                    default: 'comms',
                    enum: ['comms', 'message'],
                    description: 'Which log to fetch'
                },
                start: {
                    type: "number",
                    description: 'Starting line to fetch.'
                },
                end: {
                    type: "number",
                    description: 'Ending line to fetch.'
                },
                limit: {
                    type: "number",
                    description: 'Max number to return.'
                }
            },
            required: ['logType']
        } as JSONSchema7
    }
    
    override async run(params:{logType:'comms'|'message',start:number,end:number,limit:number}) {
        let logger;
        if (params.logType === 'comms') {
            logger = this.tightcnc.loggerMem;
        }
        else if (params.logType === 'message') {
            logger = this.tightcnc.messageLog;
        }
        else {
            throw errRegistry.newError('INTERNAL_SERVER_ERROR','INVALID_ARGUMENT').formatMessage('Bad log type');
        }
        return logger?.section(params.start, params.end, params.limit);
    }
}
class OpProvideInput extends Operation {
    
    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/provideInput",
            type: "object",
            properties: {
                inputId: {
                    type: "number",
                    description: 'ID of the input being waited for'
                },
                value: {
                    type: 'object',
                    description: 'Value of the input to provide'
                }
            },
            required: ['inputId','value']
        } as JSONSchema7
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'params' implicitly has an 'any' type.
    run(params) {
        if (this.tightcnc.waitingForInput && this.tightcnc.waitingForInput.id === params.inputId) {
            this.tightcnc.provideInput(params.value);
        }
        else {
            throw errRegistry.newError('INTERNAL_SERVER_ERROR','BAD_REQUEST').formatMessage('Not waiting on input');
        }
    }
}
class OpCancelInput extends Operation {

    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/cancelInput",
            type: "object",
            properties: {
                inputId: {
                    type: "number",
                    description: 'ID of the input being waited for'
                }
            },
            required: ['inputId']
        } as JSONSchema7;
    }

    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'params' implicitly has an 'any' type.
    run(params) {
        if (this.tightcnc.waitingForInput && this.tightcnc.waitingForInput.id === params.inputId) {
            this.tightcnc.cancelInput();
        }
        else {
            throw errRegistry.newError('INTERNAL_SERVER_ERROR','BAD_REQUEST').formatMessage('Not waiting on input')
        }
    }
}
export default function registerOperations(tightcnc: TightCNCServer) {
    tightcnc.registerOperation(/*'getStatus',*/ OpGetStatus);
    tightcnc.registerOperation(/*'send',*/ OpSend);
    tightcnc.registerOperation(/*'hold',*/ OpHold);
    tightcnc.registerOperation(/*'resume',*/ OpResume);
    tightcnc.registerOperation(/*'cancel',*/ OpCancel);
    tightcnc.registerOperation(/*'reset',*/ OpReset);
    tightcnc.registerOperation(/*'clearError',*/ OpClearError);
    tightcnc.registerOperation(/*'realTimeMove',*/ OpRealTimeMove);
    tightcnc.registerOperation(/*'move',*/ OpMove);
    tightcnc.registerOperation(/*'home',*/ OpHome);
    tightcnc.registerOperation(/*'setAbsolutePos',*/ OpSetAbsolutePos);
    tightcnc.registerOperation(/*'probe',*/ OpProbe);
    tightcnc.registerOperation(/*'setOrigin',*/ OpSetOrigin);
    tightcnc.registerOperation(/*'waitSync',*/ OpWaitSync);
    tightcnc.registerOperation(/*'getLog',*/ OpGetLog);
    tightcnc.registerOperation(/*'provideInput',*/ OpProvideInput);
    tightcnc.registerOperation(/*'cancelInput',*/ OpCancelInput);
}
