import { JSONSchema7 } from 'json-schema';
import { Operation } from '@dianlight/tightcnc-core';
import TightCNCServer from './tightcnc-server';

class OpListMacros extends Operation {

    override getParamSchema() {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/listMacros',
            type: 'null',
        } as JSONSchema7
    }


    async run() {
        const list = this.tightcnc.macros?.listAllMacros();
        list?.sort((a, b) => {
            if (a.name < b.name)
                return -1;
            if (a.name > b.name)
                return 1;
            return 0;
        });
        return Promise.resolve(list);
    }
}


class OpRunMacro extends Operation {
    
    override getParamSchema() {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/runMacro',
            type: 'object',
            properties: {
                macroName: {
                    type: 'string',
                    description: 'Name of the macro to run',
                    default: 'anonymous'
                },
                macro: {
                    type: 'string',
                    description: 'Macro to run',
                    /*
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    validate: (val) => {
                        if (val.indexOf(';') !== -1)
                            throw new commonSchema.FieldError('invalid', 'Raw javascript not allowed from client');
                    }
                    */
                },
                params: {
                    type: 'object',
                    default: {}
                },
                waitSync: {
                    type: 'boolean',
                    default: true,
                    description: 'Whether to wait until all pushed gcode runs'
                }
            },
            required: ['macro']
        } as JSONSchema7;
    }
    
    async run(params: {
        macro: string;
        params: { [key: string]: unknown };
        waitSync: boolean;
        macroName: string;
    }) {
        this.checkReady();
        return this.tightcnc.runMacro(params.macro, params.params, { waitSync: params.waitSync, macroName: params.macroName }).then(
            () => {
                return {
                    status: 'ok'
                };
            }
        )
    }
}


export default function registerOperations(tightcnc: TightCNCServer) {
    tightcnc.registerOperation(/*'listMacros',*/ OpListMacros);
    tightcnc.registerOperation(/*'runMacro',*/ OpRunMacro);
}
