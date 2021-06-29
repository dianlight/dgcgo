import blessed from 'blessed';
import { errRegistry } from '../server/errRegistry';
import objtools from 'objtools';
import fs from 'fs';
import path from 'path';
import { ConsoleUI } from './consoleui';
import ModeControl from './mode-control';
import JobOption from './job-option';
export default class ModeNewJob extends ModeControl {

    jobFilename?: string
    jobMacro?: string
    jobMacroParams: any
    jobOptionInstances?: {
        [key:string]: JobOption
    }
    dryRunResults?: {
        stats: {
            lineCount: number
            time: number
        }
    }
    jobInfoBox?: blessed.Widgets.BoxElement
    fileLastCwd?: string
    foleLastCwd?: string

    constructor(consoleui:ConsoleUI) {
        super(consoleui);
        this.resetJobInfo(false);
    }
    updateJobInfoText() {
        let jobInfoStr = '';
        if (this.jobFilename)
            jobInfoStr += 'File: ' + this.jobFilename + '\n';
        if (this.jobMacro)
            jobInfoStr += 'Generator Macro: ' + this.jobMacro + '\n';
        for (let jobOptionName in (this.jobOptionInstances || {})) {
            let inst = this.jobOptionInstances![jobOptionName];
            let optionStr = inst.getDisplayString();
            if (optionStr) {
                jobInfoStr += '\n' + optionStr.trim();
            }
        }
        if (this.dryRunResults && this.dryRunResults.stats && this.dryRunResults.stats.lineCount) {
            jobInfoStr += '\n\n{bold}Dry Run Results{/bold}\n';
            jobInfoStr += 'Line count: ' + this.dryRunResults.stats.lineCount + '\n';
            let timeHours = Math.floor(this.dryRunResults.stats.time / 3600);
            let timeMinutes = Math.floor((this.dryRunResults.stats.time - timeHours * 3600) / 60);
            if (timeMinutes < 10)
                // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type 'number'.
                timeMinutes = '0' + timeMinutes;
            jobInfoStr += 'Est. Time: ' + timeHours + ':' + timeMinutes + '\n';
            let bounds = objtools.getPath(this.dryRunResults, 'gcodeProcessors.final-job-vm.bounds');
            if (bounds) {
                jobInfoStr += 'Bounds: ' + this.consoleui.pointToStr(bounds[0]) + ' to ' + this.consoleui.pointToStr(bounds[1]) + '\n';
            }
        }
        jobInfoStr = jobInfoStr.trim();
        if (!jobInfoStr) {
            jobInfoStr = '{bold}New Job{/bold}';
        }
        else {
            jobInfoStr = '{bold}New Job Info:{/bold}\n' + jobInfoStr;
        }
        this.jobInfoBox?.setContent(jobInfoStr);
        this.consoleui.render();
    }
    selectJobFile() {
        this.consoleui.showWaitingBox();
        this.consoleui.client?.op<string[]>('listFiles', {})
            .then((files) => {
            this.consoleui.hideWaitingBox();
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'f' implicitly has an 'any' type.
            files = files.filter((f) => f.type === 'gcode').map((f) => f.name);
            let fileListBox = blessed.list({
                style: {
                    selected: {
                        inverse: true
                    },
                    item: {
                        inverse: false
                    }
                },
                keys: true,
                items: files,
                width: '50%',
                height: '50%',
                border: {
                    type: 'line'
                },
                top: 'center',
                left: 'center'
            });
            this.box.append(fileListBox);
            fileListBox.focus();
            fileListBox.once('select', () => {
                let selectedFile = files[fileListBox.index];
                this.jobFilename = selectedFile;
                this.jobMacro = undefined;
                this.jobMacroParams = {};
                this.dryRunResults = undefined;
                this.box.remove(fileListBox);
                this.updateJobInfoText();
            });
            fileListBox.once('cancel', () => {
                this.box.remove(fileListBox);
                this.consoleui.render();
            });
            this.consoleui.render();
        })
            .catch((err) => {
            this.consoleui.clientError(err);
            this.consoleui.hideWaitingBox();
        });
    }
    selectJobMacro() {
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'm' implicitly has an 'any' type.
        const macroFilterFn = (m) => {
            return /^generator-/.test(m);
        };
        this.consoleui.macroSelector(null, undefined, macroFilterFn)
            .then((minfo) => {
            if (!minfo)
                return;
            this.jobMacro = minfo.macro;
            this.jobMacroParams = minfo.macroParams;
            this.jobFilename = undefined;
            this.dryRunResults = undefined;
            this.updateJobInfoText();
        })
            .catch((err) => this.consoleui.clientError(err));
    }
    selectJobOption() {
        this.dryRunResults = undefined;
        let optionNames = Object.keys(this.consoleui.jobOptionClasses);
        let containerBox = blessed.box({
            width: '50%',
            border: {
                type: 'line'
            },
            height: '50%',
            top: 'center',
            left: 'center'
        });
        let boxTitle = blessed.box({
            width: '100%',
            height: 1,
            align: 'center',
            content: 'Configure Job Option'
        });
        containerBox.append(boxTitle);
        let listBox = blessed.list({
            style: {
                selected: {
                    inverse: true
                },
                item: {
                    inverse: false
                }
            },
            keys: true,
            items: optionNames,
            width: '100%-2',
            height: '100%-3',
            top: 1,
            border: {
                type: 'line'
            }
        });
        containerBox.append(listBox);
        this.box.append(containerBox);
        listBox.focus();
        listBox.on('select', () => {
            //this.box.remove(containerBox);
            let optionName = optionNames[listBox.index];
            if (!this.jobOptionInstances![optionName]) {
                let cls = this.consoleui.jobOptionClasses[optionName];
                this.jobOptionInstances![optionName] = new cls(this.consoleui);
            }
            let r = this.jobOptionInstances![optionName].optionSelected();
            if (r && typeof r.then === 'function') {
                // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
                r.catch((err) => this.clientError(err));
                r.then(() => listBox.focus());
            }
            this.consoleui.render();
        });
        listBox.on('cancel', () => {
            containerBox.remove(listBox);
            this.box.remove(containerBox);
            this.consoleui.render();
        });
        this.consoleui.render();
    }
    uploadFile() {
        let fileSelector = blessed.filemanager({
            cwd: this.foleLastCwd,
            width: '50%',
            height: '50%',
            top: 'center',
            left: 'center',
            border: {
                type: 'line'
            },
            style: {
                selected: {
                    inverse: true
                },
                item: {
                    inverse: false
                }
            },
            keys: true
        });
        this.box.append(fileSelector);
        fileSelector.focus();
        fileSelector.once('cancel', () => {
            this.box.remove(fileSelector);
            this.consoleui.render();
        });
        fileSelector.once('file', (filename) => {
            this.fileLastCwd = fileSelector.cwd;
            this.box.remove(fileSelector);
            this.consoleui.render();
            this.consoleui.showWaitingBox('Uploading ...');
            fs.readFile(filename, (err, fileData) => {
                if (err) {
                    this.consoleui.hideWaitingBox();
                    this.consoleui.clientError(err);
                    return;
                }
                //fileData = fileData.toString('utf8');
                let fileBaseName = path.basename(filename);
                this.consoleui.client?.op('uploadFile', {
                    filename: fileBaseName,
                    data: fileData.toString('utf8')
                })
                    .then(() => {
                    this.consoleui.hideWaitingBox();
                    this.consoleui.showTempMessage('File uploaded.');
                    this.jobFilename = fileBaseName;
                    this.jobMacro = undefined;
                    this.jobMacroParams = {};
                    this.dryRunResults = undefined;
                    this.updateJobInfoText();
                })
                    .catch((err) => {
                    this.consoleui.hideWaitingBox();
                    this.consoleui.clientError(err);
                });
            });
        });
        this.consoleui.render();
        fileSelector.refresh();
    }
    makeJobOptionsObj() {
        if (!this.jobOptionInstances)
            this._instantiateJobOptions();
        let obj:any = {};
        if (this.jobFilename)
            (obj as any).filename = this.jobFilename;
        else if (this.jobMacro) {
            (obj as any).macro = this.jobMacro;
            (obj as any).macroParams = this.jobMacroParams;
        }
        if (!(obj as any).filename && !(obj as any).macro)
            throw errRegistry.newError('INTERNAL_ERROR','INVALID_ARGUMENT').formatMessage('No filename specified');
        for (let key in (this.jobOptionInstances || {})) {
            this.jobOptionInstances![key].addToJobOptions(obj);
        }
        // This event allows other components to hook into and modify the job options object just before it is sent
        this.consoleui.emit('newJobObject', obj);
        return obj;
    }
    jobDryRunToFile() {
        let inputBox = blessed.box({
            width: '50%',
            height: 3,
            border: {
                type: 'line'
            },
            top: 'center',
            left: 'center'
        });
        let inputTextbox = blessed.textbox({
            inputOnFocus: true,
            width: '100%',
            height: 1
        });
        inputBox.append(inputTextbox);
        this.box.append(inputBox);
        inputTextbox.focus();
        inputTextbox.on('submit', () => {
            let filename = inputTextbox.getValue();
            this.box.remove(inputBox);
            this.consoleui.render();
            if (!filename)
                return;
            this.jobDryRun(filename);
        });
        inputTextbox.on('cancel', () => {
            this.box.remove(inputBox);
            this.consoleui.render();
        });
        this.consoleui.render();
    }
    jobDryRun(toFile?:string) {
        let jobOptions;
        try {
            jobOptions = this.makeJobOptionsObj();
        }
        catch (err) {
            this.consoleui.showTempMessage(err.message);
            return;
        }
        if (toFile) {
            if (!/(\.nc|\.gcode)$/i.test(toFile)) {
                toFile += '.nc';
            }
            (jobOptions as any).outputFilename = toFile;
        }
        this.consoleui.showWaitingBox('Running ...');
        this.consoleui.client?.op<{
            stats: {
                lineCount: number;
                time: number;
            };
        }>('jobDryRun', jobOptions)
            .then((result) => {
            this.dryRunResults = result;
            this.consoleui.showTempMessage('Dry run complete.');
            this.consoleui.hideWaitingBox();
            this.updateJobInfoText();
        })
            .catch((err:any) => {
            this.consoleui.clientError(err);
            this.consoleui.hideWaitingBox();
        });
    }
    jobStart() {
        let jobOptions;
        try {
            jobOptions = this.makeJobOptionsObj();
        }
        catch (err) {
            this.consoleui.showTempMessage(err.message);
            return;
        }
        this.consoleui.showWaitingBox('Initializing ...');
        this.consoleui.client?.op<{
            dryRunResults: {
                stats: {
                    lineCount: number
                    time: number
                }
            }
        }>('startJob', jobOptions)
            .then((result:any) => {
                if (result.dryRunResults) {
                    this.dryRunResults = result.dryRunResults;
                }
                this.consoleui.showTempMessage('Starting job.');
                this.consoleui.hideWaitingBox();
                this.updateJobInfoText();
                this.consoleui.activateMode('jobInfo');
                })
            .catch((err:any) => {
            this.consoleui.clientError(err);
            this.consoleui.hideWaitingBox();
        });
    }
    _instantiateJobOptions() {
        this.jobOptionInstances = {};
        for (let optionName in this.consoleui.jobOptionClasses) {
            if (!this.jobOptionInstances[optionName]) {
                let cls = this.consoleui.jobOptionClasses[optionName];
                this.jobOptionInstances[optionName] = new cls(this.consoleui);
            }
        }
        this.updateJobInfoText();
    }
    resetJobInfo(update = true) {
        this.jobFilename = undefined;
        this.jobMacro = undefined;
        this.jobMacroParams = undefined;
        this.dryRunResults = undefined;
        this.jobOptionInstances = undefined;
        if (update) {
            this.updateJobInfoText();
            this._instantiateJobOptions();
        }
    }
    override activateMode() {
        super.activateMode();
        if (!this.jobOptionInstances)
            this._instantiateJobOptions();
    }
    override exitMode() {
        super.exitMode();
    }
    override init() {
        super.init();
        this.jobInfoBox = blessed.box({
            width: '100%',
            height: '100%',
            content: '',
            align: 'center',
            valign: 'middle',
            tags: true
        });
        this.box.append(this.jobInfoBox);
        this.updateJobInfoText();
        this.consoleui.registerHomeKey(['n', 'N'], ['n'], 'New Job', () => this.consoleui.activateMode('newJob'), 3);
        this.registerModeKey(['escape'], ['Esc'], 'Home', () => this.consoleui.exitMode());
        this.registerModeKey(['f'], ['f'], 'Select File', () => this.selectJobFile());
        this.registerModeKey(['u'], ['u'], 'Upload File', () => this.uploadFile());
        this.registerModeKey(['g'], ['g'], 'Generator', () => this.selectJobMacro());
        this.registerModeKey(['o'], ['o'], 'Job Option', () => this.selectJobOption());
        this.registerModeKey(['r'], ['r'], 'Reset', () => this.resetJobInfo());
        this.registerModeKey(['d'], ['d'], 'Dry Run', () => this.jobDryRun());
        this.registerModeKey(['y'], ['y'], 'Run to File', () => this.jobDryRunToFile());
        this.registerModeKey(['s'], ['s'], 'Start Job', () => this.jobStart());
    }
}

export function registerConsoleUI(consoleui: ConsoleUI) {
    consoleui.registerMode('newJob', new ModeNewJob(consoleui));
};
