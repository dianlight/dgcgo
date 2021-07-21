import mkdirp from 'mkdirp';
import fs from 'fs';
import path from 'path';
import { AbstractServer } from './AbstractServer';


export class LoggerDisk {
    logDir: string
    maxFileSize: number
    keepFiles: number
    curFiles: { filename: string, num: number, size: number }[] = []
    curStream?: fs.WriteStream

    constructor(config:{ maxFileSize: number, keepFiles : number}, tightcnc:AbstractServer) {
        this.logDir = tightcnc.getFilename(undefined, 'log', true, true, true);
        this.maxFileSize = config.maxFileSize || 1000000;
        this.keepFiles = config.keepFiles || 2;
    }
    async init() {
        // Create directory if doesn't exist
        await mkdirp(this.logDir)
        
        // Get list of all log files currently in directory
        const files = await new Promise<string[]>((resolve, reject) => {
            fs.readdir(this.logDir, (err, files) => {
                if (err)
                    reject(err);
                else
                    resolve(files);
            });
        });
        this.curFiles = [];
        for (const f of files) {
            const matches = /^cnc-([0-9]+)\.log$/.exec(f);
            if (matches) {
                const num = parseInt(matches[1], 10);
                    fs.stat(path.join(this.logDir, f), (err, stats) => {
                        if (err)
                            console.error(err);
                        else
                            this.curFiles.push({ filename: f, num: num, size: stats.size });
                    });
                }
        }       
        this.curFiles.sort((a, b) => a.num - b.num);
        // Create new file if none exist
        if (!this.curFiles.length)
            this.curFiles.push({ filename: 'cnc-0001.log', num: 1, size: 0 });
        // Open most recent file
        const fullFn = path.join(this.logDir, this.curFiles[this.curFiles.length - 1].filename);
        this.curStream = fs.createWriteStream(fullFn, { flags: 'a' });
    }
    /**
     * Log a message to disk.
     *
     * @method log
     * @param {String} type - 'send', 'receive', or 'other'
     * @param {Mixed} msg
     */
    log(type:unknown, msg:string) {
        if (typeof msg !== 'string')
            msg = JSON.stringify(msg);
        if (type === 'send')
            msg = '> ' + msg;
        else if (type === 'receive')
            msg = '< ' + msg;
        else
            msg = '@ ' + msg;
        msg = msg.trim();
        msg += '\n';
        this.curStream?.write(msg);
        this.curFiles[this.curFiles.length - 1].size += msg.length;
        if (this.curFiles[this.curFiles.length - 1].size >= this.maxFileSize) {
            this.curStream?.end();
            const newNum = this.curFiles[this.curFiles.length - 1].num + 1;
            let newNumStr = `${newNum}`;
            while (newNumStr.length < 4)
                newNumStr = '0' + newNumStr;
            const newFilename = 'cnc-' + newNumStr + '.log';
            this.curFiles.push({ filename: newFilename, num: newNum, size: 0 });
            this.curStream = fs.createWriteStream(path.join(this.logDir, newFilename), { flags: 'w' });
            while (this.curFiles.length > this.keepFiles) {
                const fileToDelete = this.curFiles.shift();
                if(fileToDelete) fs.unlink(path.join(this.logDir, fileToDelete.filename), (err) => {
                    if (err)
                        console.error('LoggerDisk error removing file', err);
                });
            }
        }
    }
}