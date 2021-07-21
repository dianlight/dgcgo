import { AbstractServer } from 'src/AbstractServer';
import { JobState } from 'src/job-state';
import { GcodeVMOptions } from './GcodeVMOptions';


export interface GcodeProcessorOptions extends GcodeVMOptions {
    id?: string;
    job?: JobState;
    tightcnc: AbstractServer;
    updateOnHook?: string;
}
