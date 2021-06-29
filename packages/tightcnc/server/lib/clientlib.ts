import axios from 'axios'

export interface ClientConfig {
        port?: number
        serverPort?: number
        host: string
        authKey: string
}
export default class TightCNCClient {

    idseq = Date.now()

    constructor(private config: ClientConfig) { }

    async op<T>(opname: string, params: {
        [key:string]:any
    } = {}):Promise<T> {
        let url = this.config.host + ':' + (this.config.port || this.config.serverPort || 2363) + '/v1/jsonrpc';
        let requestData = {
            id: this.idseq++,
            jsonrpc: "2.0",
            method: opname,
            params: params
        };
        let response = await axios.post<{ error: unknown, result:T}>(url,JSON.stringify(requestData),{
            headers: {
                Authorization: 'Key ' + this.config.authKey,
                'Content-type': 'application/json'
            }
        });
        if (response.data.error) {
            throw new Error(JSON.stringify(response.data.error));
        }
        return response.data.result;
    }
}