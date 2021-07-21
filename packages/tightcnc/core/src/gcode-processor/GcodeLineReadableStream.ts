import * as node_stream from 'stream'
import GcodeLine from './GcodeLine'
import fs from 'fs'
import split2 from 'split2'
import CrispHooks from 'crisphooks'
import { errRegistry } from '../errRegistry'

export interface GcodeLineReadableStreamOptions extends Omit<node_stream.TransformOptions, 'transform'> {
    gcodeLineTransform?: (gcodeline:GcodeLine,callback:node_stream.TransformCallback)=>void
}

export class GcodeLineReadableStream extends node_stream.Transform {

    _gcodeLineTransform(gcodeline: GcodeLine, callback: node_stream.TransformCallback): void {
        callback(undefined,gcodeline)     
    } 

    constructor(private opts: GcodeLineReadableStreamOptions = {}) {
        opts.objectMode = true
        super(opts)
        if (opts.gcodeLineTransform)
            this._gcodeLineTransform = opts.gcodeLineTransform;
    }

    override _transform(chunk: GcodeLine | GcodeLine[] | string, encoding: BufferEncoding, callback: node_stream.TransformCallback): void{
        let gcodeLines: GcodeLine[];
        if (typeof chunk === 'string') {
            gcodeLines = [new GcodeLine(chunk)]
        } else if (chunk instanceof GcodeLine) {
            gcodeLines = [chunk]                      
        } else if (Array.isArray(chunk)) {
            gcodeLines = chunk
        } else {
            throw errRegistry.newError('IO_ERROR','GENERIC').formatMessage(`Unknown stream data type ${typeof chunk} '${JSON.stringify(chunk)}' `)
        }

        gcodeLines.forEach(gcodeLine => {
            CrispHooks.addHooks(gcodeLine) // Re-add Hooks on reidrated GcodeLine
            this._gcodeLineTransform(gcodeLine, (error?: Error | null | undefined, data?: unknown) => {
                callback(error, data)
            })
        })           
    }

    static fromFile(filename: string,opts?: GcodeLineReadableStreamOptions): GcodeLineReadableStream {
        return new GcodeLineReadableStream(opts).wrap(
            fs.createReadStream(filename).pipe(split2()))
    }

    static fromArray(lines: string[],opts?: GcodeLineReadableStreamOptions): GcodeLineReadableStream {
        return new GcodeLineReadableStream(opts).wrap(node_stream.Readable.from(lines))
    }
}