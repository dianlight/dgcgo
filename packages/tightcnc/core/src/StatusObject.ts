import { JobStatus } from './job-status';
import { ControllerStatus } from './controller';


export interface StatusObject {
    controller?: ControllerStatus | undefined;
    job?: JobStatus | undefined;
    requestInput?: {
        prompt: any;
        schema: any;
        id: number;
    };
    units?: 'mm' | 'in';
}
