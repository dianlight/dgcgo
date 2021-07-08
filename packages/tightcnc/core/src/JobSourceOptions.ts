import { AbtractJobState } from './AbstractJobState';
import { GcodeProcessor } from './gcode-processor/GcodeProcessor';


export interface JobSourceOptions {
    filename?: string | undefined;
    macro?: string | undefined;
    macroParams?: any;
    rawFile?: boolean;
    gcodeProcessors?: {
        name: string;
        options: {
            id: string;
            updateOnHook?: string;
        };
        order?: number;
        inst?: GcodeProcessor;
    }[] | undefined;
    data?: string[];
    rawStrings?: boolean;
    dryRun?: boolean;
    job?: AbtractJobState;
}
