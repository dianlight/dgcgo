import http from 'http';
import { TightCNCConfig } from 'tightcnc'

    /*
    export interface Status {
        'controller': {
            'ready': boolean,
            'axisLabels': ['x', 'y', 'z'],
            'usedAxes': [boolean, boolean, boolean],
            'mpos': [number, number, number],
            'pos': [number, number, number],
            'mposOffset': [number, number, number],
            'activeCoordSys': number,
            'offset': [number, number, number],
            'offsetEnabled': boolean,
            'storedPositions': [[number, number, number], [number, number, number]],
            'homed': [boolean, boolean, boolean],
            'held': boolean,
            'units': 'mm'|'in',
            'feed': number,
            'incremental': boolean,
            'moving': boolean,
            'coolant': boolean,
            'spindle': boolean,
            'line': number,
            'error': boolean,
            'errorData': typeof XError,
            'programRunning': boolean,
            'comms': {
                'sendQueueLength': number,
                'sendQueueIdxToSend': number,
                'sendQueueIdxToReceive': number
            }
        },
        'job': string | null
    }
	*/

	export class Client {

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
			Object.assign(this.config,config);
        }

        public getConfig(): Partial<TightCNCConfig> {
            return this.config;
        }
        
        static async start(config: Partial<TightCNCConfig>): Promise<Client> {
            return new Promise((resolve, reject) => {
                const tight_client = new Client(config);
                window.api.invoke<Partial<TightCNCConfig>,number>('StartTightCNC',tight_client.config).then((pid) => {
                    console.log('PID', pid);
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

		async op<T>(opname: string, params = {}): Promise<T> {
			const requestData = {
				method: opname,
				params: params
			};
			const postData = JSON.stringify(requestData);
			return new Promise((resolve) => {
				const req = http.request({
					hostname: new URL(this.config.host as string).hostname,
					port: this.config.serverPort,
					path: '/v1/jsonrpc',
					method: 'POST',
					headers: {
						Authorization: 'Key ' + (this.config.authKey || ''),
						'Content-type': 'application/json',
						'Content-Length': Buffer.byteLength(postData)
					}
				}, (res) => {
					res.setEncoding('utf8');
					let result = '';
					res.on('data', (chunk) => {
						result+=chunk;
					});
					res.on('end', () => {
						resolve(JSON.parse(result));
					});
				});
				req.write(postData);
				req.end();
			});
		}
	}

