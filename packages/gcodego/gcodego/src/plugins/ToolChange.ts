
import { GcPlugin, GcPluginDependencies } from './GcPlugin'
import { JobStatus } from '@dianlight/tightcnc';
import * as objtools from 'objtools'
import { JsonSchema7, UISchemaElement } from '@jsonforms/core/lib';

export class ToolChange extends GcPlugin {

    activatePlugin(): boolean {
        this.adapter.registerJobStatusUpdateHook(this.statusHook)
        return true
    }
    
    deactivatePlugin(): boolean {
        this.adapter.unregisterJobStatusUpdateHook(this.statusHook)
        return true
    }

    dependencies(): GcPluginDependencies {
        return {
            tightcncProcessors: ['toolChange'],
            tightcncOptionalProcessors: ['autolevel']
        }
    }

    statusHook = (state: JobStatus) => {
        //console.log('Nuovo stato job:', state)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const jobWaiting = (state.state === 'waiting')?state.waits[0]:undefined;
        if (jobWaiting === 'tool_change') {
            const toolNum = objtools.getPath(state, 'gcodeProcessors.toolchange.tool') as string;
            let textobj = '<b>Waiting for Tool Change</b><br/>';
            if (toolNum !== null && toolNum !== undefined) {
                textobj += 'Tool number: ' + toolNum;
            }
            this.adapter.showDialog('Tool Change',textobj, ['Continue', 'Manual Tool Offset'/*,'Probe'*/]).then(async (select) => {
                if (select === 'Manual Tool Offset') {
                    // Dialog to return a ToolOffset
                    await this.adapter.showJsonFormDialog<{ toolOffset: number }>(
                        'Tool change action required',
                        {
                            type:'object',
                            properties: {
                                toolOffset: {
                                    type: 'number',
                                    description: 'Tool Offset'
                                }
                            }
                        } as JsonSchema7,
                        {
                            type: 'HorizontalLayout',
                            elements: [
                                {
                                    type: 'Control',
                                    label: 'Tool Offset',
                                    scope: '#/properties/toolOffset'
                                }
                            ]
                        } as UISchemaElement
                    ).then((data) => {
                        void this.adapter.tightcnc.op('setToolOffset',data).then(()=>this.statusHook(state))                        
                    }).catch((err) => {
                        if (err) console.error(err)
                        this.statusHook(state)
                    })
                }  else if (select === 'Continue') {
                    await this.adapter.tightcnc.op('resumeFromStop')
                }
            }).catch(() => {
                // Chiuso il dialog senza scegliere. Che facciamo?!?!
            })
        } else if (jobWaiting === 'program_stop') {
            const textobj = 'Program Stop';
            this.adapter.showDialog('Program Stop',textobj, ['Continue']).then(async () => {
                await this.adapter.tightcnc.op('resumeFromStop')
            }).catch(() => {
                // Chiuso il dialog senza scegliere. Che facciamo?!?!
            })
        }
    }
  
}