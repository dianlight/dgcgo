import { Operation } from '@dianlight/tightcnc-core';
import fs from 'fs';
import path from 'path';
import TightCNCServer from './tightcnc-server';
import { addExitCallback } from 'catch-exit/dist/index';
//import { filemanager } from 'blessed';
import { JSONSchema7 } from 'json-schema';

class OpListFiles extends Operation {

    override getParamSchema() {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/listFiles',
            type: 'object',
            properties: {
                dir: {
                    type: 'string',
                    default: 'data',
                    description: 'Name of directory to list'
                }
            },
            required: ['dir']
        } as JSONSchema7;
    }

    async run(params: { dir: string }) {
        const dir = this.tightcnc.getFilename(undefined, params.dir, false, true, true);
        const files = await new Promise<string[]>((resolve, reject) => {
            fs.readdir(dir, (err: any, files: string[] | PromiseLike<string[]>) => {
                if (err)
                    reject(err);
                else
                    resolve(files);
            });
        });
        const retfiles = [];
        for (const file of files) {
            const stat = await new Promise<fs.Stats>((resolve, reject) => {
                fs.stat(path.join(dir, file), (err, stat) => {
                    if (err)
                        reject(err);
                    else
                        resolve(stat);
                });
            });
            let type;
            if (stat.isDirectory()) {
                type = 'dir';
            }
            else if (stat.isFile() && /(\.gcode|\.nc)$/i.test(file)) {
                type = 'gcode';
            }
            else {
                type = 'other';
            }
            retfiles.push({
                name: file,
                type: type,
                mtime: stat.mtime.toISOString()
            });
        }
        retfiles.sort((a, b) => {
            if (a.mtime > b.mtime)
                return -1;
            if (a.mtime < b.mtime)
                return 1;
            if (a.name < b.name)
                return -1;
            if (a.name > b.name)
                return 1;
            return 0;
        });
        return retfiles;
    }
}
class OpUploadFile extends Operation {

    override getParamSchema() {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            $id: '/uploadFile',
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'Remote filename to save file as',
                    /*
                    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    validate: (val) => {
                        if (!(/\.(nc|gcode)$/i.test(val)))
                            throw new commonSchema.FieldError('invalid', 'Filename must end in .nc or .gcode');
                        if (val.indexOf('/') !== -1)
                            throw new commonSchema.FieldError('invalid', 'Subdirectories not supported');
                    }
                    */
                },
                data: {
                    type: 'string',
                    description: 'File data'
                }
            },
            required: ['filename', 'data']
        } as JSONSchema7;
    }

    async run(params: {
        filename: string,
        data: string
        makeTmp?: boolean
    }) {
        const fullFilename = this.tightcnc.getFilename(params.filename, 'data', false, true);
        await new Promise<void>((resolve, reject) => {
            fs.writeFile(fullFilename, params.data, (err) => {
                if (err)
                    reject(err);
                else {
                    if (params.makeTmp) {
                        addExitCallback(signal => {
                            console.debug('Removing tmp file', fullFilename, signal)
                            fs.unlinkSync(fullFilename)
                        })
                    }
                    resolve();
                }
            });
        });
    }
}

export function registerOperations(tightcnc: TightCNCServer) {

    tightcnc.registerOperation(/*'listFiles',*/ OpListFiles);
    tightcnc.registerOperation(/*'uploadFile',*/ OpUploadFile);

}
