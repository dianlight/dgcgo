import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import { JobState } from './job-state';


export interface JobSourceOptions {
    filename?: string | undefined;
    macro?: string | undefined;
    macroParams?: unknown | undefined;
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
    job?: JobState;
}
