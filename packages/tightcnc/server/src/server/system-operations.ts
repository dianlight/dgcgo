import  Operation from './operation';
import  TightCNCServer, { TightCNCConfig } from './tightcnc-server';
import  SerialPort, { PortInfo } from 'serialport';
//import { resolve } from 'path/posix';
//import { GcodeProcessor } from './new-gcode-processor/GcodeProcessor';
import { JSONSchema7 } from 'json-schema';
import { UISchemaElement } from '@jsonforms/core'
import { errRegistry } from './errRegistry';
import { GcodeProcessorLifeCycle } from './new-gcode-processor/GcodeProcessor';



class OpGetRunningConfig extends Operation {

    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getRunningConfig",
        } as JSONSchema7
    }

    async run(): Promise<TightCNCConfig> {
        return new Promise<TightCNCConfig>((resolve, reject) => {
            if (this.tightcnc.config) resolve(this.tightcnc.config)
            else throw errRegistry.newError('INTERNAL_SERVER_ERROR','GENERIC').formatMessage('Running config not found!')
        })
    }

}


class OpGetAvailableSerials extends Operation {

    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getAvailableSerials",
        } as JSONSchema7
    }

    async run(): Promise<PortInfo[]> {
        return new Promise<PortInfo[]>((resolve, reject) => {
            SerialPort.list().then(portInfos => {
                // console.log('Serial PortInfo', portInfos)
                resolve(portInfos)
            })
        })
    }

}

class OpGetAvailableOperations extends Operation {

    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getAvailableOperations",
        } as JSONSchema7
    }

    async run(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            resolve(Object.keys(this.tightcnc.operations))
        })
    }

}


class OpGetAvailableGcodeProcessors extends Operation {

    override getParamSchema() {
        return {
            $schema: "http://json-schema.org/draft-07/schema#",
            $id: "/getAvailableGcodeProcessors",
        } as JSONSchema7
    }

    async run(): Promise<Record<string,{
        schema: JSONSchema7,
        uiSchema: UISchemaElement | void,
        lifeCycle: GcodeProcessorLifeCycle    
    }>> {
        return new Promise<Record<string,{
            schema: JSONSchema7,
            uiSchema: UISchemaElement | void
            lifeCycle: GcodeProcessorLifeCycle    
        }>>((resolve, reject) => {
            resolve(Object.keys(this.tightcnc.gcodeProcessors)
                .reduce((prev: Record<string, {
                    schema: JSONSchema7,
                    uiSchema: (UISchemaElement | void),
                    lifeCycle: GcodeProcessorLifeCycle                        
                }>, cur: string) => {
                    prev[cur] = {
                        schema: this.tightcnc.gcodeProcessors[cur].getOptionSchema(),
                        uiSchema: this.tightcnc.gcodeProcessors[cur].getOptionUISchema(),
                        lifeCycle: this.tightcnc.gcodeProcessors[cur].getLifeCicle()
                    }
                    return prev;
                }, {} as Record<string, {
                    schema: JSONSchema7,
                    uiSchema: UISchemaElement | void,
                    lifeCycle: GcodeProcessorLifeCycle                        
                }>))
        })
    }

}

/*
class OpShutdown extends Operation {
    async run(): Promise<void> {
        this.tightcnc!.shutdown()
    }

  //  getParamSchema() { return {} }
}
*/

export default function registerOperations(tightcnc: TightCNCServer) {
    tightcnc.registerOperation(/*'getAvailableSerials',*/ OpGetAvailableSerials);
    tightcnc.registerOperation(/*'getAvailableOperations',*/ OpGetAvailableOperations);
    tightcnc.registerOperation(/*'getAvailableGcodeProcessors',*/ OpGetAvailableGcodeProcessors);
    tightcnc.registerOperation(OpGetRunningConfig)
//    tightcnc.registerOperation('shutdown', OpShutdown);
}
