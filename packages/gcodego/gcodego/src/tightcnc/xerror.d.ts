declare module 'xerror' {
    interface RegisterOption {
        [key: string]: unknown,
        // default error message to use with this error code
        message?: string,
        // the http response code to map from this error code
        http?: number,
        // you can add other custom fields as well
        aliasOf?: string
    }
    
    export class XError {

        [key: string]: unknown

        static NOT_FOUND: string

        code: string; //  The string error code, like internal_error
        message: string; // - Human-readable error message
        data?: unknown; //  - Object containing extra data about the error
        privateData?: unknown; // - Object containing sensitive data about the error
        cause?: Error | XError; // - XError or Error instance that triggered this error
        stack?: string; // - Stack trace of where this error is constructed

        constructor(message: string)
        constructor(code: string, message?: string,  data?: unknown, privateData?: unknown, cause?: Error | XError)
        
        static wrap(cause: Error | XError): XError

        
        static registerErrorCode(code: string, options: RegisterOption ): void;
        
        static registerErrorCodes(codes:{
            [key: string]: RegisterOption
        }): void;
        
        static getErrorCode(code: string): string;
 
        static listErrorCodes(): string[];
    }
}