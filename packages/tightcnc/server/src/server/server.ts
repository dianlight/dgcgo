import express from 'express';
//import littleconf from 'littleconf';
import TightCNCServer from './tightcnc-server';
import { Operation, TightCNCConfig } from '@dianlight/tightcnc-core'
import { createJSONRPCErrorResponse, JSONRPC, JSONRPCID, JSONRPCMethod, JSONRPCRequest, JSONRPCResponse, JSONRPCResponsePromise, JSONRPCServer } from 'json-rpc-2.0';
import cors from 'cors'
import { addExitCallback, CatchSignals } from 'catch-exit/dist/index';
//import { JSONSchema7 } from 'json-schema';
import Ajv, { Schema } from 'ajv'
import config from 'config';
import { BaseError } from 'new-error';

//const config = littleconf.getConfig()
//const config = config.get

const ajv = new Ajv()


async function startServer() {

	// const router = new APIRouter();
	const server = new JSONRPCServer()
	const app = express();
	app.use(express.json({ limit: '1Gb' }))
	app.use(cors())

	const tightcnc = new TightCNCServer(config as unknown as TightCNCConfig);
	await tightcnc.initServer();

	app.post('/v1/jsonrpc', (req, res) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const jsonRPCRequest = req.body;
		const authHeader = req.header('Authorization');
		if (!authHeader) {
			res.sendStatus(403);
		} else {
			const parts = authHeader.split(' ');
			if (parts.length > 2) parts[1] = parts.slice(1).join(' ');
			const authType = parts[0].toLowerCase();
			const authString = parts[1];

			if (authType === 'key') {
				if (config.has('authKey') && authString === config.get('authKey')) {
					// server.receive takes an optional second parameter.
					// The parameter will be injected to the JSON-RPC method as the second parameter.
					void server.receive(jsonRPCRequest).then((jsonRPCResponse) => {
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


	function registerOperationAPICall(operationName: string, operation: Operation) {

		const mapResultToJSONRPCResponse = (
			id: JSONRPCID | undefined,
			result: unknown
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
			error?: BaseError
		): JSONRPCResponse | null => {
			if (id !== undefined) {
				return createJSONRPCErrorResponse(
					id,
					0 /*DefaultErrorCode*/,
					(error && error.message) || 'An unexpected error occurred'
				);
			} else {
				return null;
			}
		};


		function toJSONRPCObject(
			object: Operation
		): JSONRPCMethod {
			return (request: JSONRPCRequest): JSONRPCResponsePromise => {
				const validator = ajv.getSchema(object.getParamSchema().$id || '') || ajv.compile(object.getParamSchema() as Schema)
				const valid = validator(request.params)
				if (!valid) {
					console.warn(request.params, object.getParamSchema().$id, validator.errors)
				}
				const response = object.run(request.params as Record<string, unknown>)
				return Promise.resolve(response).then(
					(result: unknown) => mapResultToJSONRPCResponse(request.id, result),
					(error: BaseError) => {
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

	for (const operationName in tightcnc.operations) {
		registerOperationAPICall(operationName, tightcnc.operations[operationName]);
	}

	let serverPort = 2363;
	if (config.has('serverPort')) {
		serverPort = config.get('serverPort');
	}
	app.listen(serverPort, () => {
		console.log(`Listening on port ${serverPort}`);
	});

}

// Exit hook 

addExitCallback((signal: CatchSignals, exitCode?: number, error?: Error) => {
	console.log('TightCNC exit for signal ', signal, exitCode)
	if (error) {
		console.error(error)
	}
})

// start the server


startServer()
	.catch((err: Error) => {
		console.error(err);
		console.error(err.stack);
	});
