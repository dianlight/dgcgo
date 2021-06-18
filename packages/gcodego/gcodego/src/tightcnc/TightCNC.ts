//import http from 'http';
import { TightCNCConfig,PortInfo, StatusObject,JobSourceOptions,JobStatus } from 'tightcnc'
import { uid } from 'quasar'
import { JSONRPCClient, JSONRPCParams } from 'json-rpc-2.0';

export class Client {
        
    jsonrpc: JSONRPCClient

        config: Partial<TightCNCConfig> = {
            enableServer: true,
            authKey: '123Minni',
          //  controller: 'grbl',
            host: 'http://localhost',
			serverPort: 12345,
            controllers: {
                grbl: {
                    baudRate: 115200,
                    dataBits: 8,
                    parity: 'none',
                    port: '/dev/null',
                    stopBits: 1,
                    usedAxes: [true, true, true],
                    homableAxes: [true, true, true]
                }
            }
        }
        

		constructor(config: Partial<TightCNCConfig>) {
            Object.assign(this.config, config);

            const serverUrl = new URL(`${this.config.host as string}:${this.config.serverPort as number}/v1/jsonrpc`)
            
            console.log('Server URL:',serverUrl.toString())

            this.jsonrpc = new JSONRPCClient(
                // It can also take a custom parameter as the second parameter.
                (jsonRPCRequest) => {
             //       console.debug('-->Params:',jsonRPCRequest)
                    return fetch(serverUrl.toString(), {
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
                                .then((jsonRPCResponse) => this.jsonrpc.receive(jsonRPCResponse));
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        } else if (jsonRPCRequest.id) {
                            return Promise.reject(new Error(response.statusText));
                        }
                    })
                }
                );
        }

        public getConfig(): Partial<TightCNCConfig> {
            return this.config;
        }
        
        static async start(config: Partial<TightCNCConfig>): Promise<Client> {
            console.log(config)
            if (!config.authKey) {
                config.authKey = uid()
                console.log('Generated AuthKey:',config.authKey)
            }
            return new Promise((resolve, reject) => {
                const tight_client = new Client(config);
                window.api.invoke<Partial<TightCNCConfig>, { serverPort: number, pid: number }>('StartTightCNC', tight_client.config)
                    .then((res) => {
                        console.info('TightCNC Pid', res.pid);
                        tight_client.config.serverPort = res.serverPort
                        resolve(tight_client)
                    }).catch((err) => {
                        console.error(err);
                        reject(err)
                    });
            })
        }

        static async stop(): Promise<void> {       
            return window.api.invoke('StopTightCNC')
        }
    
        async restart(): Promise<void> {
            return new Promise(resolve => {
                void Client.stop().then(() => {
                    console.debug('Restaring....')
                    void Client.start(this.config).then(() => {
                        resolve()
                    })
                })
            })    
        }

        static saveConfig(config: Partial<TightCNCConfig>) {
            const cc = JSON.parse(JSON.stringify(config)) as Partial<TightCNCConfig>
            //console.log('Save config',cc)
            window.api.send('SaveTightCNCConfig', cc);
        }

        updateConfig(config: Partial<TightCNCConfig>, restart?: boolean) {
            const cc = JSON.parse(JSON.stringify(config)) as Partial<TightCNCConfig>
            this.config = cc;
            //console.log('Save config',cc)
            window.api.send('SaveTightCNCConfig', cc);
            if (restart) void this.restart()
        }
    
        static async loadConfig(): Promise<Partial<TightCNCConfig>> {
           return window.api.invoke<undefined,Partial<TightCNCConfig>>('LoadTightCNCConfig')
        }

        async op<T>(opname: string, params?: JSONRPCParams): Promise<T> {
            return this.jsonrpc.request(opname,params||{})
        } 

        /**
         * Specific direct functions
         */
    
        getStatus(): Promise<Partial<StatusObject>> {
            return   this.op<Partial<StatusObject>>('getStatus')
        }

        getAvailableSerials(): Promise<PortInfo[]>{
            return this.op<PortInfo[]>('getAvailableSerials')
        }

        jogMove(axis:number,inc:number): Promise<void> {
            return this.op('realTimeMove', { axis: axis, inc: inc })    
        }
    
        home(axes?: boolean[]): Promise<void> {
            return this.op('home', { axes:axes })
        }
    
        uploadFile(filename:string, data: string, makeTmp:boolean):Promise<string> {
            return this.op<string>('uploadFile',{filename,data,makeTmp})
        }
    
        startJob(jobOptions: JobSourceOptions): Promise<JobStatus> {
            return this.op<JobStatus>('startJob',jobOptions)
        }
    
        resume(): Promise<void>{
            return this.op('resume')    
        }
    
    
    
	}

