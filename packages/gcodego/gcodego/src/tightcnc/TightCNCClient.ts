import {
    TightCNCConfig,
    PortInfo,
    StatusObject,
    JobSourceOptions,
    JobStatus,
} from 'tightcnc';
import { uid } from 'quasar';
import { JSONRPCClient, JSONRPCParams } from 'json-rpc-2.0';
import { EventEmitter } from 'events';
import objectHash from 'object-hash';
import { timeout } from 'utils-decorators';
import { Notify } from 'quasar'
import objtools from 'objtools'

export interface GcodeGoConfig extends TightCNCConfig {
    selectedProcessors: string[];
    selectedPlugins: string[];
    probe: {
        bookmarkPositions: { x: number, y: number }[],
        z: number,
        feed: number
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

export class TightCNCClient extends EventEmitter {
    jsonrpc: JSONRPCClient;
    serverUrl: Promise<string> = new Promise(() => {/* Infinite Promise */ })


    hashes: Record<ClientEvents, string> = {
        'job-status-update': '0x0000',
        'client-config-updated': '0x0000',
        'client-connection-error': '0x0000',
        'op-error': '0x0000'
    };

    private config: Partial<GcodeGoConfig> = {
        enableServer: true,
        controllers: {
            grbl: {
                baudRate: 115200,
                dataBits: 8,
                parity: 'none',
                port: '/dev/null',
                stopBits: 1,
                usedAxes: [true, true, true],
                homableAxes: [true, true, true],
            },
        },
        probe: {
            bookmarkPositions: [],
            z: -0.1,
            feed: 25
        }
    };

    constructor(config: Partial<TightCNCConfig>) {
        super();
        Object.assign(this.config, config);

        this.jsonrpc = new JSONRPCClient((jsonRPCRequest) => {
            return this.serverUrl.then((serverUrl) => {
                return fetch(serverUrl, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        authorization: `key ${this.config.authKey || ''}`,
                    },
                    body: JSON.stringify(jsonRPCRequest),
                }).then((response) => {
                    if (response.status === 200) {
                        // Use client.receive when you received a JSON-RPC response.
                        return response
                            .json()
                            .then((jsonRPCResponse) => {
                                //console.log('Risposta', jsonRPCResponse, this.jsonrpc)
                                this.jsonrpc.receive(jsonRPCResponse)
                            }
                            ).catch(err => console.error('Errore!', err));
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    } else if (jsonRPCRequest.id) {
                        //console.log('Questo errore', jsonRPCRequest)
                        return Promise.reject(new Error(response.statusText));
                    }
                }).catch(err => {
                    this.emit('client-connection-error', err)
                    throw err
                });
            })
        });

        this.on('client-config-updated', (config: Partial<GcodeGoConfig>) => {
            //console.log('Update config event', config)
            this.serverUrl = Promise.resolve(new URL(
                `${config.host as string}:${config.serverPort as number}/v1/jsonrpc`
            ).toString())

            console.log('Server URL:', this.serverUrl/*, config.authKey*/);
        })

        this.on('op-error', (error: Error) => {
            Notify.create({
                message: error.message,
                type: 'negative'
            })
        })

    }

    getConfig(): Partial<GcodeGoConfig> {
        return this.config;
    }

    @timeout(30000)
    async start(): Promise<TightCNCConfig> {
        console.log('Start config:', this.config);
        if (!this.config.authKey) {
            this.config.authKey = uid();
            console.log('Generated AuthKey:', this.config.authKey);
        }
        return new Promise((resolve, reject) => {
            window.api
                .invoke<Partial<TightCNCConfig>, { serverPort: number; pid: number }>(
                    'StartTightCNC',
                    this.config
                )
                .then(async (res) => {
                    console.info('TightCNC Pid', res.pid);
                    await this.loadRunningConfig(true).then((config) => resolve(config))
                })
                .catch((err) => {
                    console.error(err);
                    reject(err);
                });
        });
    }

    async stop(): Promise<void> {
        return window.api.invoke('StopTightCNC');
    }

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

    saveConfig(config?: Partial<TightCNCConfig>) {
        const cc = JSON.parse(JSON.stringify(this.config)) as Partial<TightCNCConfig>;
        Object.assign(cc, config)
        //console.log('Save config',cc)
        window.api.send('SaveTightCNCConfig', cc);
    }

    updateConfig(config: Partial<GcodeGoConfig>, restart?: boolean) {
        const cc = JSON.parse(JSON.stringify(config)) as Partial<GcodeGoConfig>;
        this.config = cc;
        if (this.fireUniqueEvent('client-config-updated', cc)) {
            console.log('Need Save config', cc)
            window.api.send('SaveTightCNCConfig', cc);
            if (restart) void this.restart();
        }
    }

    updateConfigKey(key: string, value: unknown) {
        objtools.setPath(this.config, key, value)
        this.saveConfig(this.config)
    }

    getConfigKey<T>(key: string, defvalue?: T): T {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return objtools.getPath(this.config, key) || defvalue
    }

    /**
     * Load the stored config from the storage
     * @returns {GcodeGoConfig} the loaded and applied config
     */
    async loadConfig(): Promise<Partial<GcodeGoConfig>> {
        return window.api
            .invoke<undefined, Partial<GcodeGoConfig>>('LoadTightCNCConfig')
            .then((config) => {
                Object.assign(this.config, config);
                console.log('LoadedConfig:', this.config)
                this.emit('client-config-updated', this.config);
                return this.config;
            });
    }

    /**
     * Send a generic JSON-RPC call to the client
     *
     * @param opname
     * @param params
     * @returns
     */
    //@timeout(15000)
    async op<T>(opname: string, params?: JSONRPCParams): Promise<T> {
        return this.jsonrpc.request(opname, params).then(
            x => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return x;
            },
            (err: unknown) => {
                //console.error('Intercettato in OP:', err)
                this.emit('op-error', err)
                throw err
            }
        )
    }

    /**
     * Specific direct functions
     */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private fireUniqueEvent(event: ClientEvents, ...args: any[]): boolean {
        const nh = objectHash(args);
        if (this.hashes[event] !== nh) {
            this.hashes[event] = nh;
            return this.emit(event, ...args);
        } else {
            return false;
        }
    }

    getStatus(): Promise<Partial<StatusObject>> {
        return this.op<Partial<StatusObject>>('getStatus', {}).then((status) => {
            if (status.job) {
                this.fireUniqueEvent('job-status-update', status.job);
            }
            return status;
        });
    }

    getAvailableSerials(): Promise<PortInfo[]> {
        return this.op<PortInfo[]>('getAvailableSerials');
    }

    jogMove(axis: number, inc: number): Promise<void> {
        return this.op('realTimeMove', { axis: axis, inc: inc });
    }

    home(axes?: boolean[]): Promise<void> {
        return this.op('home', { axes: axes });
    }

    uploadFile(
        filename: string,
        data: string,
        makeTmp: boolean
    ): Promise<string> {
        return this.op<string>('uploadFile', { filename, data, makeTmp });
    }

    startJob(jobOptions: JobSourceOptions): Promise<JobStatus> {
        return this.op<JobStatus>('startJob', jobOptions);
    }

    resume(): Promise<void> {
        return this.op('resume');
    }

    loadRunningConfig(apply?: boolean): Promise<TightCNCConfig> {
        return new Promise((resolve) => {
            void this.op<TightCNCConfig>('getRunningConfig')
                .then((config) => {
                    if (apply) {
                        this.config = config;
                        this.fireUniqueEvent('client-config-updated', this.config)
                    }
                    resolve(config);
                })
        })
    }

    /**
     *  Log Based function
     */
    getLog(
        logType: 'comms' | 'message',
        start?: number,
        end?: number,
        limit?: number
    ): Promise<LogLine[]> {
        return this.op<[number, string][]>('getLog', {
            logType,
            start,
            end,
            limit,
        }).then((lines) => {
            return lines
                .map((l) => {
                    return {
                        line: l[0],
                        direction: l[1].substr(0, 1) as LogLineDirection,
                        data: l[1].substr(2),
                    } as LogLine;
                })
                .map((log) => {
                    if (log.direction === '>') {
                        if (log.data === '?') {
                            log.direction = '%';
                        }
                    } else {
                        if (log.data.startsWith('<')) log.direction = '%';
                    }
                    return log;
                });
        });
    }
}

export type JobStatusUpdateHookCallback = (newstate: JobStatus) => void;

export type ClientEvents =
    'job-status-update' |
    'client-config-updated' | 'client-connection-error' | 'op-error'
    ;
