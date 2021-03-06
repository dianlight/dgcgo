export class LoggerMem {

    linesToKeep: number
    shiftBatchSize: number
    lines: [number,string][]
    nextNum: number

    constructor(config:{size: number, shiftBatchSize: number}) {
        this.linesToKeep = config.size || 5000;
        this.shiftBatchSize = config.shiftBatchSize || Math.ceil(this.linesToKeep / 10);
        this.lines = [];
        this.nextNum = 1;
    }
    log(type:string, msg?:string) {
        if (msg === undefined) {
            // single argument given - log raw line
            msg = type;
        }
        else {
            // 2 arguments given, a type and a message
            if (typeof msg !== 'string')
                msg = JSON.stringify(msg);
            if (type === 'send')
                msg = '> ' + msg;
            else if (type === 'receive')
                msg = '< ' + msg;
            else
                msg = '@ ' + msg;
            msg = msg.trim();
        }
        this.lines.push([this.nextNum, msg]);
        this.nextNum++;
        if (this.lines.length >= this.linesToKeep + this.shiftBatchSize) {
            this.lines = this.lines.slice(this.lines.length - this.linesToKeep);
        }
    }
    clear() {
        this.lines = [];
        //this.nextNum = 1;
    }
    section(start?:number, end?:number, limit?:number): [number, string][] {
        if (start === undefined)
            start = 0;
        if (start < 0)
            start = this.nextNum + start;
        if (start > this.nextNum) {
            // Assume that server has restarted and client hasn't caught up.  Return the desired number of lines, up to the end of our buffer.
            if (end === undefined) {
                if (!limit)
                    return this.lines;
                else
                    return this.lines.slice(-limit);
            }
            else if (end <= start) {
                return [];
            }
            else {
                let numRequested = end - start;
                if (limit && limit < numRequested)
                    numRequested = limit;
                let startIdx = this.lines.length - numRequested;
                if (startIdx < 0)
                    startIdx = 0;
                return this.lines.slice(startIdx);
            }
        }
        if (start === this.nextNum || !this.lines.length)
            return [];
        const linesStartNum = this.lines[0][0];
        if (start < linesStartNum)
            start = linesStartNum;
        if (end === undefined)
            end = this.nextNum;
        if (end < 0)
            end = this.nextNum + end;
        if (end > this.nextNum)
            end = this.nextNum;
        if (end <= start)
            return [];
        let startIdx = start - linesStartNum;
        const endIdx = end - linesStartNum;
        if (limit && endIdx - startIdx > limit)
            startIdx = endIdx - limit;
        return this.lines.slice(startIdx, endIdx);
    }
}
