import express from 'express';
import littleconf from 'littleconf';
import TightCNCServer from './tightcnc-server';
import { createJSONRPCErrorResponse, JSONRPC, JSONRPCID, JSONRPCMethod, JSONRPCRequest, JSONRPCResponse, JSONRPCResponsePromise, JSONRPCServer } from 'json-rpc-2.0';
import Operation from './operation';
import cors from 'cors'
import { addExitCallback, CatchSignals } from 'catch-exit';
//import { JSONSchema7 } from 'json-schema';
import Ajv from 'ajv'

const config = littleconf.getConfig()

const ajv = new Ajv()


async function startServer() {

	// const router = new APIRouter();
	const server = new JSONRPCServer()
	const app = express();
	app.use(express.json({ limit:'1Gb'}))
	app.use(cors())

	let tightcnc = new TightCNCServer(config);
	await tightcnc.initServer();

	app.post("/v1/jsonrpc", (req, res) => {
		const jsonRPCRequest = req.body;
		let authHeader = req.header('Authorization');
		if (!authHeader) {
			res.sendStatus(403);
		} else {
			let parts = authHeader.split(' ');
			if (parts.length > 2) parts[1] = parts.slice(1).join(' ');
			let authType = parts[0].toLowerCase();
			let authString = parts[1];

			if (authType === 'key') {
				if (config.authKey && authString === config.authKey) {
					// server.receive takes an optional second parameter.
					// The parameter will be injected to the JSON-RPC method as the second parameter.
					server.receive(jsonRPCRequest).then((jsonRPCResponse) => {
						if (jsonRPCResponse) {
							res.json(jsonRPCResponse);
						} else {
							res.sendStatus(204);
						}
					});
				  } else {
					res.sendStatus(401)
				}
			} else {
				res.status(406).send('Unsupported authorization type: ' + authType);
			}
		}
	});

	app.all('*', (req, res, next) => {
		console.error('Unknown request ', req)
		next()
	})
	
	
	function registerOperationAPICall(operationName: string, operation: any) {

		const mapResultToJSONRPCResponse = (
			id: JSONRPCID | undefined,
			result: any
		  ): JSONRPCResponse | null => {
			if (id !== undefined) {
			  return {
				jsonrpc: JSONRPC,
				id,
				result: result === undefined ? null : result,
			  };
			} else {
			  return null;
			}
		};
		
		const mapErrorToJSONRPCResponse = (
			id: JSONRPCID | undefined,
			error: any
		  ): JSONRPCResponse | null => {
			if (id !== undefined) {
			  return createJSONRPCErrorResponse(
				id,
				0 /*DefaultErrorCode*/,
				(error && error.message) || "An unexpected error occurred"
			  );
			} else {
			  return null;
			}
		};
		

		function toJSONRPCObject(
			object: Operation
		): JSONRPCMethod {
			return (request: JSONRPCRequest): JSONRPCResponsePromise => {
				const validator = ajv.getSchema(object.getParamSchema().$id || '') || ajv.compile(object.getParamSchema())				
				const valid = validator(request.params)
				if (!valid) {
					console.warn(request.params,object.getParamSchema().$id, validator.errors)
				}
				let response = object.run(request.params);
				return Promise.resolve(response).then(
					(result: any) => mapResultToJSONRPCResponse(request.id, result),
					(error: any) => {
					console.warn(
						`JSON-RPC method ${request.method} responded an error`,
						error
					);
					return mapErrorToJSONRPCResponse(request.id, error);
					}
				);
			};
		}
		server.addMethodAdvanced(operationName, toJSONRPCObject(operation))
		
	}

	for (let operationName in tightcnc.operations) {
		registerOperationAPICall(operationName, tightcnc.operations[operationName]);
	}

	let serverPort = config.serverPort || 2363;
	app.listen(serverPort, () => {
		console.log('Listening on port ' + serverPort);
	});

}

// Exit hook 

addExitCallback( (signal: CatchSignals, exitCode?: number, error?: Error) => {
	console.log("TightCNC exit for signal ", signal, exitCode)
	if (error) {
		console.error(error)
	}
})

// start the server


startServer()
	.catch((err) => {
		console.error(err);
		console.error(err.stack);
	});
