import Operation from './operation';
import TightCNCServer, { JobSourceOptions } from './tightcnc-server';
import { JSONSchema7 } from 'json-schema';

const jobOptionsSchema = {
    type: 'object',
    properties: {
        filename: {
            type: "string",
            description: 'Filename of gcode to run'
        },
        macro: {
            type: "string",
            description: 'Name of generator macro to use as gcode source',
            /*
            validate: (str: string) => {
                / *
                if (str.indexOf(';') !== -1)
                    throw new commonSchema.FieldError('invalid', 'Cannot supply raw javascript');
                if (!/^generator-/.test(str))
                    throw new commonSchema.FieldError('invalid', 'Macro name must begin with generator-');
                    * /
            }
            */
        },
        macroParams: {
            type: 'object',
            description: 'Macro parameters, if macro is used'
        },
        rawFile: {
            type: "boolean",
            default: false,
            description: 'Do not process the gcode in the file at all.  Also disables stats.'
        },
        gcodeProcessors: {
            type: 'array',
            items: {
                type: 'object',
                properties:{
                    name: {
                        type: "string",
                        description: 'Name of gcode processor',
                    },
                    options: {
                        type: 'object',
                        description: 'Options to pass to the gcode processor',
                        default: {}
                    },
                    order: {
                        type: 'number',
                        description: 'Optional order number for gcode processor position in chain'
                    }
                },
                required:['name']
            }
        }
    },
/*
    validate(obj: JobSourceOptions) {
        / *
        if (!obj.filename && !obj.macro)
            throw new commonSchema.FieldError('invalid', 'Must supply either filename or macro');
        if (obj.filename && obj.macro)
            throw new commonSchema.FieldError('invalid', 'Cannot supply both filename and macro');
            * /
    }
    */
} as JSONSchema7;


class OpStartJob extends Operation {
    
    override getParamSchema() {
        jobOptionsSchema.$id='/startJob'
        return jobOptionsSchema;
    }
    
    async run(params: JobSourceOptions) {
        let jobOptions = {
            filename: params.filename ? this.tightcnc.getFilename(params.filename, 'data') : undefined,
            macro: params.macro,
            macroParams: params.macroParams,
            gcodeProcessors: params.gcodeProcessors,
            rawFile: params.rawFile
        };
        return await this.tightcnc!.jobManager?.startJob(jobOptions);
    }
}

interface JobOptionsDryRun extends JobSourceOptions {
    outputFilename: string
}
class OpJobDryRun extends Operation {
    
    override getParamSchema() {
        jobOptionsSchema.$id='/jobDryRun'
        jobOptionsSchema.properties!.outputFilename = {
            type: "string",
            description: 'Save processed gcode from dry run into this file'
        } as JSONSchema7
        return jobOptionsSchema
    }
    

    async run(params: JobOptionsDryRun) {
        let jobOptions = {
            filename: params.filename ? this.tightcnc.getFilename(params.filename, 'data') : undefined,
            macro: params.macro,
            macroParams: params.macroParams,
            gcodeProcessors: params.gcodeProcessors,
            rawFile: params.rawFile
        };
        return await this.tightcnc!.jobManager?.dryRunJob(jobOptions, params.outputFilename ? this.tightcnc?.getFilename(params.outputFilename, 'data') : undefined);
    }
}
export default function registerOperations(tightcnc: TightCNCServer) {
    tightcnc.registerOperation(/*'startJob',*/ OpStartJob);
    tightcnc.registerOperation(/*'jobDryRun',*/ OpJobDryRun);
}
