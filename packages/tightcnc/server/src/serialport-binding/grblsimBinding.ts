import AbstractBinding from "@serialport/binding-abstract"
import { OpenOptions, PortInfo } from "serialport"
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { addExitCallback } from 'catch-exit';
import path from 'path'
import os from 'os'

export default class GrblsimBinding extends AbstractBinding {

    process?: ChildProcessWithoutNullStreams;
    _buffer: Buffer[] = []
    options?: OpenOptions

    public isOpen = false;


    constructor(private opt: OpenOptions) {
        super(opt)
    }

    static override async list(): Promise<PortInfo[]>{
        //console.log('L>')
        return Promise.resolve([])
    }
  
    /**
     * Opens a connection to the serial port referenced by the path. Promise resolves after the port
     * is opened, configured and ready for use.
     * @param {string} path the path or com port to open
     * @param {openOptions} options openOptions for the serialport
     * @returns {Promise} Resolves after the port is opened and configured.
     */
    override async open(_path: string, options: OpenOptions): Promise<void> {
        this.options = options
        return new Promise<void>((resolve, reject) => {
            const url = new URL(_path)
            //console.log(url,url.href.substr(8))
            if (url.protocol !== 'grblsim:') return reject(new Error("Only grblsim://<path to grbl_sim.exe > path are supported"))
            this.process = spawn(url.href.substr(8), ['-t','10','-n','-r','1','-s',path.join(os.tmpdir(), '/log_step.out'),'-b',path.join(os.tmpdir(),'/log_block.out')], {
                shell: false,
                stdio: ['pipe','pipe','pipe']
            })
            console.log('grblsim pid',this.process.pid)
            this.process.on('error', (err) => {
                console.error('Z:',err)
                reject(err)
            })
            this.process.stdout.on("data", (data) => {
            //    console.log("<",JSON.stringify(data.toString()))
                this._buffer.push(data)
            })
            this.process.stderr.on("data", (data) => {
                console.error("<grbl>",JSON.stringify(data.toString()))
            })
            this.process.on('exit', (code,signal) => {
                console.error("<grbl>Exit:", code,'Signal:',signal)
                this.isOpen = false
                this.process = undefined
                if(!signal)this.open(_path,options)
            })
            process.on('beforeExit', (code) => {
                console.error(`TightCNC server shutdown.. ${code}`)
                this.closeSync()
            })
            addExitCallback(signal => {
                console.log('TighCNC Exit hook')
                this.closeSync()
            });
            this.isOpen = true
            resolve()
        })
    }

    /**
     * Closes an open port
     */
    override async close(): Promise<void> {
        console.log("Closign GRBLSym")
        return new Promise<void>((resolve, reject) => {
            if (!this.process) return reject(new Error('no process to close!'))
            return super.close().then(() => {
                this.closeSync()
                resolve()
            });
        })
    }

    private closeSync():void {
        console.error("Process Alive. Kill it!")
        this.process?.kill('SIGINT')
        console.error("Process closed?", !this.process?.connected);
        this.process = undefined;
        this.isOpen = false;
    }
    /**
     * Request a number of bytes from the SerialPort. This function is similar to Node's
     * [`fs.read`](http://nodejs.org/api/fs.html#fs_fs_read_fd_buffer_offset_length_position_callback)
     * except it will always return at least one byte.
  
     * The in progress reads must error when the port is closed with an error object that has the
     * property `canceled` equal to `true`. Any other error will cause a disconnection.
  
     * @param {buffer} buffer Accepts a [`Buffer`](http://nodejs.org/api/buffer.html) object.
     * @param {integer} offset The offset in the buffer to start writing at.
     * @param {integer} length Specifies the maximum number of bytes to read.
     * @returns {Promise} Resolves with the number of bytes read after a read operation.
     */
    override async read(buffer: Buffer, offset: number, length: number): Promise<{ bytesRead: number, buffer: Buffer }> {
        return new Promise((resolve, reject) => {
            if (!this.process)return reject(new Error("Process not exist!"))
            const reader = () => {
                if (this._buffer.length == 0) {
                    setTimeout(reader, 1000)
                } else {
                    if (this._buffer[0].length <= length) {
                        const nextBuffer = this._buffer.splice(0, 1)[0]
                        nextBuffer.copy(buffer, offset, 0)
                        return resolve({
                            bytesRead: nextBuffer.length,
                            buffer: buffer
                        })
                    } else {
                        const nextBuffer = this._buffer[0]
                        nextBuffer.copy(buffer, offset, 0, length)
                        this._buffer[0] = this._buffer[0].slice(length)
                        return resolve({
                            bytesRead: length,
                            buffer: buffer
                        })
                    }
                }
            }
            reader()
        })
    }

    /**
     * Write bytes to the SerialPort. Only called when there is no pending write operation.
  
     * The in-progress writes must error when the port is closed, with an error object that has the
     * property `canceled` equal to `true`. Any other error will cause a disconnection.
  
     * @param {buffer} buffer - Accepts a [`Buffer`](http://nodejs.org/api/buffer.html) object.
     * @returns {Promise} Resolves after the data is passed to the operating system for writing.
     */
    override async write(buffer: Buffer): Promise<void> {
       // console.log(">", JSON.stringify(buffer.toString()))
        return new Promise((resolve, reject) => {
            if (!this.process) return reject(new Error("GRBL_sim process is closed!"))
            this.process.stdin.write(buffer, (error) => {
                if (error) {
                    console.error(error)
                    reject(error)
                } else {
                    resolve()
                }             
            })
            
        })
    }

    /**
     * Changes connection settings on an open port. Only `baudRate` is supported.
     * @returns {Promise} Resolves once the port's baud rate changes.
     */
    override async update(options: { baudRate: number }): Promise<void> {
        //console.log('U->',options)
        return Promise.resolve()
    }

    /**
     * Set control flags on an open port.
     * @param {object=} options All options are operating system default when the port is opened.
     * Every flag is set on each call to the provided or default values. All options are always provided.
     * @param {Boolean} [options.brk=false] flag for brk
     * @param {Boolean} [options.cts=false] flag for cts
     * @param {Boolean} [options.dsr=false] flag for dsr
     * @param {Boolean} [options.dtr=true] flag for dtr
     * @param {Boolean} [options.rts=true] flag for rts
     * @returns {Promise} Resolves once the port's flags are set.
     */
    override async set(options: { brk: boolean, cts: boolean, dst: boolean, dtr: boolean, rts: boolean }): Promise<void> {
        //console.log('S>',options)
        return Promise.resolve()
    }

    /**
     * Get the control flags (CTS, DSR, DCD) on the open port.
     * @returns {Promise} Resolves with the retrieved flags.
     */
    override async get(): Promise<{
        cts: boolean;
        dsr: boolean;
        dcd: boolean;
    }> { /* Flags */
        //console.log('<-G ')
        return Promise.resolve({
            cts: false,
            dsr: false,
            dcd: false
        })
    }

    /**
     * Get the OS reported baud rate for the open port. Used mostly for debugging custom baud rates.
     */
    override async getBaudRate(): Promise<number> {
       return Promise.resolve(this.opt.baudRate?this.opt.baudRate:0)
    }

    /**
     * Flush (discard) data received but not read, and written but not transmitted.
     * @returns {Promise} Resolves once the flush operation finishes.
     */
    override async flush(): Promise<void> {
        //console.log('F')
        this._buffer = []
        return Promise.resolve()
    }

    /**
     * Drain waits until all output data is transmitted to the serial port. An in-progress write
     * should be completed before this returns.
     * @returns {Promise} Resolves once the drain operation finishes.
     */
    override async drain(): Promise<void> {
        //console.log('D')
        return Promise.resolve()

    }
}