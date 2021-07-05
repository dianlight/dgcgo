import {
    TightCNCConfig,
    PortInfo,
    StatusObject,
    JobSourceOptions,
    JobStatus,
} from '@dianlight/tightcnc';
import { EventEmitter } from 'events';
import { JSONRPCParams } from 'json-rpc-2.0';


export interface GcodeGoConfig extends TightCNCConfig {
    selectedProcessors: string[];
    selectedPlugins: string[];
    probe: {
        bookmarkPositions: { x: number, y: number }[],
        z: number,
        feed: number
    },
    machine: {
        zsafe: number
    }
}

export type LogLineDirection = '<' | '>' | '@' | '%';

export interface LogLine {
    line: number;
    direction: LogLineDirection;
    data: string;
    result?: string;
    error?: string;
}

export abstract class AbstractTightCNCClient extends EventEmitter {


    abstract start(): Promise<TightCNCConfig>;

    abstract stop(): Promise<void>;

    async restart(): Promise<void> {
        return new Promise((resolve) => {
            void this.stop().then(() => {
                console.debug('Restaring....');
                void this.start().then(() => {
                    resolve();
                });
            });
        });
    }

    /**
     * Update a single config key
     * @param key the key path
     * @param value the new value
     */
    abstract updateConfigKey<T>(key: string, value: T): T;


    /**
     * Return a single config key
     * @param key  the key path
     * @param defvalue a default value if no key exists
     * @returns 
     */
    abstract getConfigKey<T>(key: string, defvalue: undefined, createIfmissing: undefined): T | undefined;

    /**
     * Return a single config key
     * @param key  the key path
     * @param defvalue a default value if no key exists
     * @returns 
     */
    abstract getConfigKey<T>(key: string, defvalue: T, createIfmissing?: boolean): T;

    abstract getConfigKey<T>(key: string, defvalue?: T, createIfmissing?: boolean): T;


    /**
     * Send a generic JSON-RPC call to the client
     *
     * @param opname
     * @param params
     * @returns
     */
    abstract op<T>(opname: string, params?: JSONRPCParams): Promise<T>;

    abstract getStatus(): Promise<Partial<StatusObject>>;

    abstract getAvailableSerials(): Promise<PortInfo[]>;

    abstract jogMove(axis: number, inc: number): Promise<void>;

    abstract realTimeMove(axis: number, inc: number): Promise<void>;

    abstract move(pos: (number | boolean)[], feed?: number): Promise<void>;

    abstract machineMove(pos: (number | boolean)[]): Promise<void>;

    abstract home(axes?: boolean[]): Promise<void>;

    abstract uploadFile(
        filename: string,
        data: string,
        makeTmp: boolean
    ): Promise<string>;

    abstract startJob(jobOptions: JobSourceOptions): Promise<JobStatus>;

    abstract resume(): Promise<void>;

    abstract getConfig(): Partial<GcodeGoConfig>;

   
    /**
     *  Log Based function
     */
    abstract getLog(
        logType: 'comms' | 'message',
        start?: number,
        end?: number,
        limit?: number
    ): Promise<LogLine[]>;
}

export type JobStatusUpdateHookCallback = (newstate: JobStatus) => void;

export type ClientEvents =
    'job-status-update' |
    'client-config-updated' | 'client-connection-error' | 'op-error'
    ;

export class Test {
    atest = true
}    