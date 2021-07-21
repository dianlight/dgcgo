//import { GcodeProcessor } from './gcode-processor/GcodeProcessor';
import { VMState } from './gcode-processor/VMState';

export interface JobStatus {
    state: string,
    jobOptions?: Record<string,unknown>,
    dryRunResults?: Partial<JobStatus>,
    startTime: unknown,
    error?: string | undefined,
    gcodeProcessorsStatus?: Record<string,Partial<VMState>>,
    stats?: Record<string,unknown>,
    progress?: {
        gcodeLine: number;
        timeRunning: unknown;
        estTotalTime: unknown;
        estTimeRemaining: number;
        percentComplete: number;
    },
    waits?: string[]
}