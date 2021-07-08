import { ErrorRegistry } from "new-error";

export const ERRORS = {
    INTERNAL_SERVER_ERROR: {
        className: 'InternalServerError',
        code: '500',
        statusCode: 500,
        logLevel: 'error',
    },
    INTERNAL_ERROR: {
        className: 'InternalError',
        code: 'I500',
        logLevel: 'error',
    },
    IO_ERROR: {
        className: 'IOError',
        code: '500',
        logLevel: 'error',
    },
    MACHINE_ERROR: {
        className: 'CNCError',
        code: '900',
        logLevel: 'warn'
    },
    PARSE_ERROR: {
        className: 'ParserError',
        code: '990',
        logLevel: 'warn'
    }
}

export const ERRORCODES = {
    GENERIC: {
        message: '%s',
        subCode: '-1',
        statusCode: 500,
        logLevel: 'error'

    },
    INVALID_ARGUMENT: {
        message: 'Invalid Argument: %s',
        subCode: '001',
        statusCode: 500,
        logLevel: 'error'
    },
    BAD_REQUEST: {
        message: 'Bad Request: %s',
        subCode: '002',
        statusCode: 400,
        logLevel: 'error'
    },
    CANCELLED: {
        message: 'Cancelled: %s',
        subCode: 'CN_001',
        statusCode: 204,
        logLevel: 'warn'
    },
    MACHINE_ERROR: {
        message: 'Machine Error: %s',
        subCode: 'CN_002',
        statusCode: 204,
        logLevel: 'warn'
    },
    SAFETY_INTERLOCK: {
        message: 'Door: %s',
        subCode: 'ME_003',
        statusCode: 204,
        logLevel: 'warn'
    },
    PROBE_INITIAL_STATE: {
        message: 'Initial state: %s',
        subCode: 'ME_004',
        statusCode: 204,
        logLevel: 'warn'
    },
    PROBE_NOT_TRIPPED: {
        message: 'Probe not Tripped: %s',
        subCode: 'ME_005',
        statusCode: 204,
        logLevel: 'warn'        
    },
    COMM_ERROR:{
        message: 'Communication Error: %s',
        subCode: 'IO_006',
        statusCode: 204,
        logLevel: 'warn'        
    },
    LIMIT_HIT: {
        message: 'Limit Hit: %s',
        subCode: 'LM_007',
        statusCode: 204,
        logLevel: 'warn'                
    },
    GCODE_PARSER_ERROR: {
        message: 'Error parsing gcode: %s',
        subCode: 'GE_008',
        statusCode: 204,
        logLevel: 'warn'                
    },
    NOT_FOUND: {
        message: 'Not found: %s',
        subCode: 'ME_009',
        statusCode: 404,
        logLevel: 'warn'                
    },
    UNSUPPORTED_OPERATION: {
        message: 'Unsupported Operation: %s',
        subCode: 'GE_010',
        statusCode: 400,
        logLevel: 'error'                
    },


}

export const errRegistry = new ErrorRegistry(ERRORS, ERRORCODES)

