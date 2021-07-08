import { TightCNCControllers } from "./TightCNCControllers";


export interface TightCNCConfig {
    enableServer: boolean;
    baseDir: string;
    authKey: string; //'abc123',
    serverPort: number; // 2363,
    host: string; //'http://localhost',
    controller: keyof TightCNCControllers;
    controllers: TightCNCControllers;
    paths: {
        [key: string]: string;
        data: string;
        log: string;
        macro: string;
    };
    plugins: string[];
    operations: {
        probeSurface: {
            defaultOptions: {
                probeSpacing: number;
                probeFeed: number;
                clearanceHeight: number;
                autoClearance: boolean;
                autoClearanceMin: number;
                probeMinZ: number;
                numProbeSamples: number;
                extraProbeSampleClearance: number;
            };
        };
    };
    logger: {
        maxFileSize: number;
        keepFiles: number;
    };
    loggerMem: {
        size: number;
        shiftBatchSize: number;
    };
    messageLog: {
        size: number;
        shiftBatchSize: number;
    };
    recovery: {
        // rewind this number of seconds before the point where the job stopped
        backUpTime: number;
        // additionall back up for this number of lines before that (to account for uncertainty in which lines have been executed)
        backUpLines: number;
        // This is a list of gcode lines to execute to move the machine into a clearance position where it won't hit the workpiece
        // The values {x}, {y}, etc. are replaced with the coordinates of the position (touching the workpiece) to resume the job.
        moveToClearance: string[];
        // List of gcode lines to execute to move from the clearance position to the position to restart the job.
        moveToWorkpiece: string[];
    };
    toolChange: {
        preToolChange: string[];
        postToolChange: string[];
        // Which axis number tool offsets apply to (in standard config, Z=2)
        toolOffsetAxis: number;
        negateToolOffset: boolean;
    };
    enableDebug: boolean;
    debugToStdout: boolean;
    suppressDuplicateErrors?: boolean;
}
