import blessed from 'blessed';
import TightCNCClient from '../../lib/clientlib';
import pasync from 'pasync';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import ListForm from './list-form';
import Littleconf from 'littleconf'
import { StatusObject } from '../server/tightcnc-server';
import ModeControl from './mode-control'
import JobOption from './job-option';



export class ConsoleUI extends EventEmitter {
    statusBoxes: {
        title: any
        data: {
            [key: string]: any
        }
        labels: {
            [key: string]: string
        }
        titleBox: blessed.Widgets.BoxElement
        box: blessed.Widgets.BoxElement
        line: blessed.Widgets.LineElement
    }[] = [];
    hints: string[] = [];
    hintOverrideStack: string[][] = [];
    config = Littleconf.getConfig();
    hintBoxHeight = 3;
    modes: {
        [key: string]: ModeControl
    } = {};
    jobOptionClasses: {
        [key: string]: { new(consoleui: ConsoleUI): JobOption }
    } = {}
    enableRendering = true;
    inputRequest: {
        lastInputId?: number,
        dialogElement?: blessed.Widgets.BoxElement,
        isHidden: boolean,
        isComplete: boolean,
        spec?: {
            prompt: any;
            schema: any;
            id: number;
        },
        recallKey?:{
            hint: any;
            keys: string;
            fn: (ch: any, key: blessed.Widgets.Events.IKeyEventArg) => void;
        }
    } = {
            isHidden: false,
            isComplete: true,
        };

    logFilename?: string;
    logFile?: number
    curLogSize = 0;
    maxLogSize = 2000000;
    logInited = true;

    lastLogStr?: string
    
    screen?: blessed.Widgets.Screen
    bottomHintBox?: blessed.Widgets.BoxElement
    mainPane?: blessed.Widgets.BoxElement
    statusPane?: blessed.Widgets.BoxElement;
    mainOuterBox?: blessed.Widgets.BoxElement;
    client?: TightCNCClient;
    messageBox?: blessed.Widgets.BoxElement;
    lastMessageEntryId: any;
    usedAxes: any;
    jobStatusBox?: {
        title: any; data: any; labels: {
            [key: string]: string
        }; titleBox: blessed.Widgets.BoxElement; box: blessed.Widgets.BoxElement; line: blessed.Widgets.LineElement;
    };
    miscStateStatusBox?: {
        title: any; data: any; labels: {
            [key: string]: string
        }; titleBox: blessed.Widgets.BoxElement; box: blessed.Widgets.BoxElement; line: blessed.Widgets.LineElement;
    };
    curTempMessageTimeout?: number /* NodeJS.Timeout */;
    waitingBox?: blessed.Widgets.BoxElement;
    lastStatus?: StatusObject;
    activeMode: any;
    machineStateStatusBox?: { title: any; data: any; labels: { [key: string]: string; }; titleBox: blessed.Widgets.BoxElement; box: blessed.Widgets.BoxElement; line: blessed.Widgets.LineElement; };
    axisLabels?: string[];
    positionStatusBox?: { title: any; data: any; labels: { [key: string]: string; }; titleBox: blessed.Widgets.BoxElement; box: blessed.Widgets.BoxElement; line: blessed.Widgets.LineElement; };


    constructor() {
        super();
    }
    async initLog() {
        let logDir = this.config.consoleui.logDir;
        await new Promise<void>((resolve, reject) => {
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
            mkdirp(logDir, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        this.logFilename = path.join(logDir, 'consoleui.log');
        this.logFile = fs.openSync(this.logFilename, 'w');
        this.curLogSize = 0;
        this.maxLogSize = 2000000;
        this.logInited = true;
    }
    // @ts-expect-error ts-migrate(7019) FIXME: Rest parameter 'args' implicitly has an 'any[]' ty... Remove this comment to see the full error message
    log(...args) {
        let str = '';
        for (let arg of args) {
            if (str)
                str += '; ';
            str += '' + arg;
        }
        if (str === this.lastLogStr)
            return;
        this.lastLogStr = str;
        if (!this.logInited) {
            console.log(str);
        }
        else {
            this.curLogSize += str.length + 1;
            if (this.curLogSize >= this.maxLogSize && this.logFile && this.logFilename) {
                fs.closeSync(this.logFile);
                this.logFile = fs.openSync(this.logFilename, 'w');
            }
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
            fs.write(this.logFile, '' + str + '\n', (err) => {
                if (err)
                    console.error('Error writing to log', err);
            });
        }
    }
    render() {
        if (this.screen && this.enableRendering)
            this.screen.render();
    }
    disableRender() {
        this.enableRendering = false;
    }
    enableRender() {
        this.enableRendering = true;
        this.render();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'keys' implicitly has an 'any' type.
    registerGlobalKey(keys, keyNames, keyLabel, fn) {
        if (!Array.isArray(keys))
            keys = [keys];
        if (keyNames && !Array.isArray(keyNames))
            keyNames = [keyNames];
        let hint = null;
        if (keyNames) {
            hint = this.addHint(keyNames, keyLabel);
        }
        this.screen?.key(keys, fn);
        return hint;
    }
    _makeHintStr(keyNames: string | string[], label: string): string {
        if (!Array.isArray(keyNames))
            keyNames = [keyNames];
        return keyNames.map((n) => '{inverse}' + n + '{/inverse}').join('/') + ' ' + label;
    }
    // hints is in form: [ [ keyNames, label ], [ keyNames, label ], ... ]
    pushHintOverrides(hints: [string, string][]) {
        let hintStrs = hints.map((a) => this._makeHintStr(a[0], a[1]));
        this.hintOverrideStack.push(hintStrs);
        this.updateHintBox();
    }
    popHintOverrides() {
        this.hintOverrideStack.pop();
        this.updateHintBox();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'keyNames' implicitly has an 'any' type.
    addHint(keyNames, label) {
        this.hints.push(this._makeHintStr(keyNames, label));
        this.updateHintBox();
        return this.hints[this.hints.length - 1];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'hint' implicitly has an 'any' type.
    removeHint(hint) {
        this.hints = this.hints.filter((h) => h !== hint);
        this.updateHintBox();
    }
    updateHintBox() {
        let hints = this.hints;
        if (this.hintOverrideStack.length)
            hints = this.hintOverrideStack[this.hintOverrideStack.length - 1];
        if (!hints.length) {
            this.bottomHintBox?.setContent('');
            return;
        }
        let totalWidth = +(this.bottomHintBox?.width || 0);
        // let rowHints = [];
        let numRowsUsed = Math.min(Math.floor(hints.length / 6) + 1, this.hintBoxHeight);
        let hintsPerRow = Math.ceil(hints.length / numRowsUsed);
        let hintWidth = Math.floor(totalWidth / hintsPerRow);
        let hintsToShow = [];
        for (let i = 0; i < hintsPerRow * numRowsUsed; i++) {
            hintsToShow[i] = hints[i] || '';
        }
        let hintBoxContent = '';
        for (let rowNum = 0; rowNum < numRowsUsed; rowNum++) {
            if (rowNum != 0)
                hintBoxContent += '\n';
            hintBoxContent += '{center}';
            for (let hintIdx = rowNum * hintsPerRow; hintIdx < (rowNum + 1) * hintsPerRow; hintIdx++) {
                let hintStrLen = hintsToShow[hintIdx].replace(/\{[^}]*\}/g, '').length;
                let padLeft = Math.floor((hintWidth - hintStrLen) / 2);
                let padRight = Math.ceil((hintWidth - hintStrLen) / 2);
                for (let i = 0; i < padLeft; i++)
                    hintBoxContent += ' ';
                hintBoxContent += hintsToShow[hintIdx];
                for (let i = 0; i < padRight; i++)
                    hintBoxContent += ' ';
            }
            hintBoxContent += '{/center}';
        }
        this.bottomHintBox?.setContent(hintBoxContent);
        this.render();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
    async runInModal(fn, options = {}) {
        let modal = blessed.box({
            width: (options as any).width || '80%',
            height: (options as any).height || '80%',
            top: 'center',
            left: 'center',
            border: (options as any).border ? { type: 'line' } : undefined
            //border: { type: 'line' },
            //content: 'MODAL CONTENT'
        });
        let container = (options as any).container || this.mainPane;
        container.append(modal);
        modal.setFront();
        this.screen?.render();
        try {
            return await fn(modal);
        }
        finally {
            container.remove(modal);
        }
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
    async runWithWait(fn, text = 'Waiting ...') {
        this.showWaitingBox(text);
        try {
            return await fn();
        }
        finally {
            this.hideWaitingBox();
        }
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'content' implicitly has an 'any' type.
    async showConfirm(content, options = {}, container?: blessed.Widgets.BoxElement) {
        if (!container)
            container = this.mainPane;
        let box = blessed.box({
            width: '50%',
            height: '30%',
            top: 'center',
            left: 'center',
            align: 'center',
            valign: 'middle',
            keyable: true,
            content: content,
            border: { type: 'line' }
        });
        let origGrabKeys = this.screen?.grabKeys;
        let r = await new Promise((resolve, reject) => {
            this.pushHintOverrides([['Esc', (options as any).cancelLabel || 'Cancel'], ['Enter', (options as any).okLabel || 'OK']]);
            box.key(['escape'], () => {
                resolve(false);
            });
            box.key(['enter'], () => {
                resolve(true);
            });
            // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
            container.append(box);
            this.render();
            box.focus();
            this.screen!.grabKeys = true;
        });
        this.popHintOverrides();
        // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
        container.remove(box);
        this.screen!.grabKeys = origGrabKeys || false;
        this.screen?.render();
        return r;
    }
    async macroSelector(container = null, macroParamMap?: {
        [key: string]: unknown
    }, macroFilterFn?: (m: any) => boolean) {
        let macroList = await this.runWithWait(async () => {
            return await this.client?.op('listMacros', {});
        });
        if (macroFilterFn) {
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'm' implicitly has an 'any' type.
            macroList = macroList.filter((m) => {
                return macroFilterFn(m.name);
            });
        }
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'm' implicitly has an 'any' type.
        let macroNames = macroList.map((m) => m.name);
        let selected = await new ListForm(this).selector(container, 'Run Macro', macroNames);
        if (typeof selected === 'number') {
            let macro = macroList[selected];
            let macroParams = {};
            if (macro.params && macro.params.type === 'object' && Object.keys(macro.params.properties).length > 0) {
                let form = new ListForm(this);
                macroParams = await form.showEditor(container, macro.params, (macroParamMap && macroParamMap[macro]) || macro.params.default || {}, { returnValueOnCancel: true });
                if (form.editorCancelled) {
                    if (macroParams && macroParamMap)
                        macroParamMap[macro] = macroParams;
                    return null;
                }
                else {
                    if (!macroParams)
                        return null;
                }
            }
            return {
                macro: macro.name,
                macroParams
            };
        }
        else {
            return null;
        }
    }
    /**
     * Adds a status box to the status box stack.
     *
     * @method addStatusBox
     * @param {String} title - Status box title
     * @param {Object} statusObj - An object mapping keys to status values to display.
     * @param {Object} labels - Optional mapping from status keys to display labels for them.
     * @return {Object} - A reference to the UI data for the box.
     */
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'title' implicitly has an 'any' type.
    addStatusBox(title, statusObj, labels?: {
        [key: string]: string
    }): {
        title: any;
        data: any;
        labels: {
            [key: string]: string;
        };
        titleBox: blessed.Widgets.BoxElement;
        box: blessed.Widgets.BoxElement;
        line: blessed.Widgets.LineElement;
    } {
        if (!labels) {
            labels = {};
            for (let key in statusObj)
                labels[key] = key;
        }
        let boxData = {
            title: title,
            data: statusObj,
            labels: labels,
            titleBox: blessed.box({
                tags: true,
                width: '100%',
                height: 1,
                content: '{center}{bold}' + title + '{/bold}{/center}'
            }),
            box: blessed.box({
                tags: true,
                width: '100%',
                content: ''
            }),
            line: blessed.line({
                type: 'line',
                orientation: 'horizontal',
                width: '100%'
            })
        };
        this.statusBoxes.push(boxData);
        this.statusPane?.append(boxData.titleBox);
        this.statusPane?.append(boxData.box);
        this.statusPane?.append(boxData.line);
        this.updateStatusBoxes();
        return boxData;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'boxData' implicitly has an 'any' type.
    removeStatusBox(boxData) {
        let boxIdx = this.statusBoxes.indexOf(boxData);
        if (boxIdx === -1) {
            for (let i = 0; i < this.statusBoxes.length; i++) {
                if (this.statusBoxes[i].data === boxData) {
                    boxIdx = i;
                    boxData = this.statusBoxes[i];
                    break;
                }
            }
            if (boxIdx === -1)
                return;
        }
        this.statusPane?.remove(boxData.titleBox);
        this.statusPane?.remove(boxData.box);
        this.statusPane?.remove(boxData.line);
        this.statusBoxes.splice(boxIdx, 1);
        this.updateStatusBoxes();
    }
    updateStatusBoxes() {
        let vOffset = 0;
        for (let boxData of this.statusBoxes) {
            let numEntries = Object.keys(boxData.labels).length;
            (boxData.box.position as any).height = numEntries;
            boxData.titleBox.position.top = vOffset;
            boxData.box.position.top = vOffset + 1;
            boxData.line.position.top = vOffset + 1 + numEntries;
            vOffset += numEntries + 2;
            let content = '';
            for (let key in boxData.labels) {
                if (content)
                    content += '\n';
                let dataStr = boxData.data[key];
                if (dataStr === null || dataStr === undefined)
                    dataStr = '';
                dataStr = '' + dataStr;
                content += boxData.labels[key] + ':{|}' + dataStr;
            }
            boxData.box.setContent(content);
        }
        this.render();
    }
    initUI() {
        this.screen = blessed.screen({
            smartCSR: true
        });
        this.screen.title = 'TightCNC Console UI';
        this.mainOuterBox = blessed.box({
            top: 0,
            height: '100%-' + (3 + this.hintBoxHeight)
        });
        this.screen.append(this.mainOuterBox);
        let messageSeparatorLine = blessed.line({
            type: 'line',
            orientation: 'horizontal',
            width: '100%',
            bottom: this.hintBoxHeight + 2
        });
        this.screen.append(messageSeparatorLine);
        this.messageBox = blessed.box({
            tags: true,
            bottom: this.hintBoxHeight + 1,
            width: '100%',
            height: 1,
            content: '',
            align: 'center'
        });
        this.screen.append(this.messageBox);
        let hintSeparatorLine = blessed.line({
            type: 'line',
            orientation: 'horizontal',
            width: '100%',
            bottom: this.hintBoxHeight
        });
        this.screen.append(hintSeparatorLine);
        this.bottomHintBox = blessed.box({
            tags: true,
            bottom: 0,
            height: this.hintBoxHeight,
            content: ''
        });
        this.screen.append(this.bottomHintBox);
        this.statusPane = blessed.box({
            left: 0,
            width: '20%',
            content: 'Status'
        });
        this.mainOuterBox.append(this.statusPane);
        let statusSeparatorLine = blessed.line({
            type: 'line',
            orientation: 'vertical',
            left: '20%',
            height: '100%'
        });
        this.mainOuterBox.append(statusSeparatorLine);
        this.mainPane = blessed.box({
            right: 0,
            width: '80%-1'
        });
        this.mainOuterBox.append(this.mainPane);
        this.screen.on('resize', () => {
            this.updateHintBox();
        });
        /*let testBox = blessed.box({
            width: '100%',
            height: '100%',
            content: '',
            input: true
        });
        testBox.key([ 'f', 'Esc' ], (ch, key) => {
            testBox.setContent('key pressed\n' + ch + '\n' + JSON.stringify(key));
            this.screen.render();
        });
        this.mainPane.append(testBox);
        testBox.focus();*/
        this.screen.render();
        //this.registerGlobalKey([ 'escape', 'C-c' ], [ 'Esc' ], 'Exit', () => process.exit(0));
    }
    registerJobOption(name: string, cls: {new(consoleui:ConsoleUI):JobOption}) {
        this.jobOptionClasses[name] = cls;
    }
    showWaitingBox(text = 'Waiting ...') {
        if (this.waitingBox)
            return;
        this.waitingBox = blessed.box({
            border: {
                type: 'line'
            },
            content: text,
            align: 'center',
            valign: 'middle',
            width: text.length + 2,
            height: 3,
            top: '50%-2',
            left: '50%-' + (Math.floor(text.length / 2) + 1)
        });
        this.mainOuterBox?.append(this.waitingBox);
        this.screen!.lockKeys = true;
        this.render();
    }
    hideWaitingBox() {
        if (!this.waitingBox)
            return;
        this.mainOuterBox?.remove(this.waitingBox);
        delete this.waitingBox;
        this.screen!.lockKeys = false;
        this.render();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'pos' implicitly has an 'any' type.
    pointToStr(pos) {
        let str = '';
        for (let axisNum = 0; axisNum < this.usedAxes.length; axisNum++) {
            if (this.usedAxes[axisNum]) {
                if (str)
                    str += ', ';
                str += (pos[axisNum] || 0).toFixed(3);
            }
        }
        return str;
    }
    async initClient():Promise<StatusObject> {
        console.log('Connecting ...');
        this.client = new TightCNCClient(this.config);
        return await this.client.op<StatusObject>('getStatus');
    }
    runMessageFetchLoop() {
        const runLoop = async () => {
            await this.serverPollLoop(async () => {
                try {
                    let newEntries = await this.client?.op<any[]>('getLog', {
                        logType: 'message',
                        start: -1,
                        limit: 1
                    });
                    let messageEntry = newEntries![0];
                    if (messageEntry && messageEntry[0] !== this.lastMessageEntryId) {
                        this.lastMessageEntryId = messageEntry[0];
                        this.setMessage(messageEntry[1]);
                    }
                }
                catch (err) {
                    this.clientError(err);
                }
            // @ts-expect-error ts-migrate(2693) FIXME: 'any' only refers to a type, but is being used as ... Remove this comment to see the full error message
            }, this.config.consoleui.log, any.messageUpdateInterval);
        };
        runLoop().catch(this.clientError.bind(this));
    }
    setupPrimaryStatusBoxes() {
        this.machineStateStatusBox = this.addStatusBox('Machine', { state: 'NOT READY', held: null, error: null }, { state: 'State', held: 'Hold', error: 'Err' });
        let posStatusInitial = {};
        let posStatusLabels = {};
        for (let i = 0; i < this.usedAxes.length; i++) {
            if (this.usedAxes[i]) {
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                posStatusInitial[this.axisLabels[i]] = null;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                posStatusLabels[this.axisLabels[i]] = this.axisLabels[i].toUpperCase();
            }
        }
        this.positionStatusBox = this.addStatusBox('Pos Cur/Mach', posStatusInitial, posStatusLabels);
        this.miscStateStatusBox = this.addStatusBox('State', {
            activeCoordSys: null,
            allAxisHomed: null,
            units: null,
            feed: null,
            incremental: null,
            moving: null,
            spindle: null,
            coolant: null
        }, {
            moving: 'Moving',
            activeCoordSys: 'Coord',
            incremental: 'Inc',
            spindle: 'Spind',
            coolant: 'Cool',
            feed: 'Feed',
            units: 'Unit',
            allAxisHomed: 'Homed'
        });
        this.jobStatusBox = this.addStatusBox('Cur. Job', {
            state: 'NONE',
            percentComplete: '',
            timeRemaining: ''
        }, {
            state: 'State',
            percentComplete: '% Done',
            timeRemaining: 'Remain'
        });
    }
    updatePrimaryStatusBoxes(status?:StatusObject):void {
        if (!status)
            return;
        let cstatus = status.controller;
        // Machine state
        let machineState = null;
        let machineError = null;
        if (cstatus!.error) {
            machineState = '{red-bg}ERROR{/red-bg}';
            if (cstatus!.errorData && (cstatus!.errorData.message || cstatus!.errorData.message)) {
                machineError = cstatus!.errorData.message || cstatus!.errorData.message;
            }
            else if (cstatus!.errorData) {
                machineError = JSON.stringify(cstatus!.errorData);
            }
            else {
                machineError = 'Unknown';
            }
        }
        else if (cstatus!.ready) {
            machineState = '{green-bg}READY{/green-bg}';
        }
        else {
            machineState = '{red-bg}NOT READY{/red-bg}';
        }
        this.machineStateStatusBox!.data.state = machineState;
        this.machineStateStatusBox!.data.error = machineError;
        this.machineStateStatusBox!.data.held = cstatus!.held ? '{red-bg}YES{/red-bg}' : 'NO';
        // Position
        const posPrecision = 3;
        for (let i = 0; i < this.usedAxes.length; i++) {
            if (this.usedAxes[i]) {
                let axis = this.axisLabels![i];
                let posStr = '';
                if (cstatus!.pos && typeof cstatus!.pos[i] === 'number') {
                    posStr += cstatus!.pos[i].toFixed(posPrecision);
                }
                if (cstatus!.mpos && typeof cstatus!.mpos[i] === 'number') {
                    posStr += '{cyan-fg}/' + cstatus!.mpos[i].toFixed(posPrecision) + '{/cyan-fg}';
                }
                this.positionStatusBox!.data[axis] = posStr;
            }
        }
        // Misc
        this.miscStateStatusBox!.data.activeCoordSys = (typeof cstatus!.activeCoordSys === 'number') ? ('G' + (cstatus!.activeCoordSys + 54)) : '';
        if (cstatus!.homed) {
            this.miscStateStatusBox!.data.allAxisHomed = '{green-fg}YES{/green-fg}';
            for (let i = 0; i < this.usedAxes.length; i++) {
                if (this.usedAxes[i] && !cstatus!.homed[i]) {
                    this.miscStateStatusBox!.data.allAxisHomed = 'NO';
                }
            }
        }
        else {
            this.miscStateStatusBox!.data.allAxisHomed = '';
        }
        this.miscStateStatusBox!.data.units = cstatus!.units;
        this.miscStateStatusBox!.data.feed = (typeof cstatus!.feed === 'number') ? cstatus!.feed.toFixed(posPrecision) : '';
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
        const boolstr = (val, iftrue = '{yellow-fg}YES{/yellow-fg}', iffalse = 'NO') => {
            if (val)
                return iftrue;
            if (val === null || val === undefined || val === '')
                return '';
            return iffalse;
        };
        this.miscStateStatusBox!.data.incremental = boolstr(cstatus!.incremental);
        this.miscStateStatusBox!.data.moving = boolstr(cstatus!.moving);
        let spindleStr = '';
        if (cstatus!.spindle === true && cstatus!.spindleDirection === 1) {
            spindleStr = '{yellow-fg}FWD{/yellow-fg}';
        }
        else if (cstatus!.spindle === true && cstatus!.spindleDirection === -1) {
            spindleStr = '{yellow-fg}REV{/yellow-fg}';
        }
        else if (cstatus!.spindle === true) {
            spindleStr = '{yellow-fg}ON{/yellow-fg}';
        }
        else if (cstatus!.spindle === false) {
            spindleStr = 'OFF';
        }
        this.miscStateStatusBox!.data.spindle = spindleStr;
        this.miscStateStatusBox!.data.coolant = boolstr(cstatus!.coolant, '{yellow-fg}ON{/yellow-fg}', 'OFF');
        // Job
        if (status.job && status.job.state !== 'none') {
            if (status.job.state === 'initializing') {
                this.jobStatusBox!.data.state = '{blue-bg}INIT{/blue-bg}';
            }
            else if (status.job.state === 'running') {
                this.jobStatusBox!.data.state = '{yellow-bg}RUN{/yellow-bg}';
            }
            else if (status.job.state === 'waiting') {
                this.jobStatusBox!.data.state = '{blue-bg}WAIT{/blue-bg}';
            }
            else if (status.job.state === 'complete') {
                this.jobStatusBox!.data.state = '{green-bg}DONE{/green-bg}';
            }
            else {
                this.jobStatusBox!.data.state = '{red-bg}' + status.job.state.toUpperCase() + '{/red-bg}';
            }
            if (status.job.progress) {
                this.jobStatusBox!.data.percentComplete = '' + status.job.progress.percentComplete.toFixed(1) + '%';
                let hoursRemaining = Math.floor(status.job.progress.estTimeRemaining / 3600);
                let minutesRemaining = Math.floor((status.job.progress.estTimeRemaining - hoursRemaining * 3600) / 60);
                if (minutesRemaining < 10)
                    // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type 'number'.
                    minutesRemaining = '0' + minutesRemaining;
                this.jobStatusBox!.data.timeRemaining = '' + hoursRemaining + ':' + minutesRemaining;
            }
            else {
                this.jobStatusBox!.data.percentComplete = '';
                this.jobStatusBox!.data.timeRemaining = '';
            }
        }
        else {
            this.jobStatusBox!.data.state = 'NONE';
            this.jobStatusBox!.data.percentComplete = '';
            this.jobStatusBox!.data.timeRemaining = '';
        }
        this.updateStatusBoxes();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'msg' implicitly has an 'any' type.
    setMessage(msg) {
        this.messageBox?.setContent(msg);
        this.render();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'msg' implicitly has an 'any' type.
    showTempMessage(msg, time = 6) {
        this.setMessage(msg);
        if (this.curTempMessageTimeout)
            clearTimeout(this.curTempMessageTimeout);
        this.curTempMessageTimeout = setTimeout(() => {
            delete this.curTempMessageTimeout;
            this.setMessage('');
        }, time * 1000) as unknown as number;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
    clientError(err) {
        this.showTempMessage(err.message || err.msg || ('' + err));
        this.log(err, err.stack);
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    _makeInputRequestDialog(container) {
        let ri = this.inputRequest.spec;
        let dialog = blessed.box({
            width: '50%',
            height: '50%',
            top: 'center',
            left: 'center',
            border: { type: 'line' }
        });
        container.append(dialog);
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'result' implicitly has an 'any' type.
        const inputGiven = (result) => {
            this.runWithWait(async () => {
                await this.client?.op('provideInput', {
                    inputId: ri!.id,
                    value: result
                });
            })
                .then(() => {
                this._closeInputRequestDialog();
                this.inputRequest.isHidden = false;
                this.inputRequest.isComplete = true;
            }, (err) => {
                this.clientError(err);
                this._dismissInputRequestDialog();
            });
        };
        if (ri && ri.schema) {
            if (ri.prompt) {
                ri.schema.title = ri.prompt;
                ri.schema.label = ri.prompt;
            }
            let form = new ListForm(this);
            form.showEditor(dialog, ri.schema)
                .then((result) => {
                if (form.editorCancelled) {
                    this._dismissInputRequestDialog();
                }
                else {
                    inputGiven(result);
                }
            }, (err) => {
                this.clientError(err);
            });
        }
        else {
            this.showConfirm(ri!.prompt || 'Hit ENTER to continue ...', {}, dialog)
                .then((result) => {
                if (!result) {
                    this._dismissInputRequestDialog();
                }
                else {
                    inputGiven(true);
                }
            }, (err) => {
                this.clientError(err);
            });
        }
        return dialog;
    }
    _showInputRequestDialog() {
        let dialog = this._makeInputRequestDialog(this.mainPane);
        this.inputRequest.dialogElement = dialog;
        this.inputRequest.isHidden = false;
        if (this.inputRequest.recallKey) {
            this.modes['home'].removeModeKey(this.inputRequest.recallKey);
            this.inputRequest.recallKey = undefined;
        }
    }
    _closeInputRequestDialog() {
        if (!this.inputRequest.dialogElement)
            return;
        this.mainPane?.remove(this.inputRequest.dialogElement);
        this.inputRequest.dialogElement = undefined;
    }
    _dismissInputRequestDialog() {
        if (this.inputRequest.isHidden || !this.inputRequest.dialogElement)
            return;
        this._closeInputRequestDialog();
        this.inputRequest.isHidden = true;
        this.inputRequest.recallKey = this.registerHomeKey(['i', 'I'], 'i', '{blue-bg}Input Req{/blue-bg}', () => {
            if (!this.inputRequest.isHidden || this.inputRequest.dialogElement)
                return;
            this._showInputRequestDialog();
        }, 1000);
        this.render();
    }
    _resetInputRequest() {
        this._closeInputRequestDialog();
        if (this.inputRequest.recallKey) {
            this.modes['home'].removeModeKey(this.inputRequest.recallKey);
            this.inputRequest.recallKey = undefined;
        }
        this.inputRequest.lastInputId = undefined;
        this.inputRequest.isHidden = false;
        this.inputRequest.isComplete = false;
    }
    _checkInputRequestOnStatusReport(status:StatusObject) {
        if (status.requestInput) {
            if (status.requestInput.id !== this.inputRequest.lastInputId) {
                if (this.inputRequest.isHidden) {
                    // remove recall keybind
                    if (this.inputRequest.recallKey) {
                        this.modes['home'].removeModeKey(this.inputRequest.recallKey);
                        this.inputRequest.recallKey = undefined;
                    }
                }
                if (this.inputRequest.dialogElement) {
                    this._closeInputRequestDialog();
                }
                this.inputRequest.spec = status.requestInput;
                // show dialog
                this._showInputRequestDialog();
                // update state vars
                this.inputRequest.lastInputId = status.requestInput.id;
                this.inputRequest.isHidden = false;
                this.inputRequest.isComplete = false;
            }
        }
        else {
            if (this.inputRequest.isHidden) {
                // remove recall keybind
                if (this.inputRequest.recallKey) {
                    this.modes['home'].removeModeKey(this.inputRequest.recallKey);
                    this.inputRequest.recallKey = undefined;
                }
            }
            if (this.inputRequest.dialogElement) {
                this._closeInputRequestDialog();
            }
            this.inputRequest.lastInputId = undefined;
            this.inputRequest.isHidden = false;
            this.inputRequest.isComplete = false;
        }
    }
    runStatusUpdateLoop() {
        const runLoop = async () => {
            await this.serverPollLoop(async () => {
                try {
                    let status = (await this.client?.op<StatusObject>('getStatus')) as StatusObject;
                    this.lastStatus = status;
                    this.axisLabels = status!.controller!.axisLabels;
                    this.usedAxes = status!.controller!.usedAxes;
                    this._checkInputRequestOnStatusReport(status);
                    this.emit('statusUpdate', status);
                    this.updatePrimaryStatusBoxes(status);
                }
                catch (err) {
                    this.clientError(err);
                    this._resetInputRequest();
                }
            });
        };
        runLoop().catch(this.clientError.bind(this));
    }

    registerMode(name: string, m: ModeControl) {
        this.modes[name] = m;
    }
    activateMode(name:string) {
        this.disableRender();
        if (this.activeMode) {
            this.modes[this.activeMode].exitMode();
        }
        this.modes[name].activateMode();
        this.activeMode = name;
        this.enableRender();
    }
    exitMode() {
        this.disableRender();
        this.modes[this.activeMode].exitMode();
        this.activeMode = null;
        this.activateMode('home');
        this.enableRender();
    }
    async registerModules() {
        require('./mode-home').registerConsoleUI(this);
        require('./mode-control').registerConsoleUI(this);
        require('./mode-log').registerConsoleUI(this);
        require('./mode-new-job').registerConsoleUI(this);
        require('./job-option-rawfile').registerConsoleUI(this);
        require('./mode-job-info').registerConsoleUI(this);
        // Register bundled plugins
        require('../plugins').registerConsoleUIComponents(this);
        // Register external plugins
        for (let plugin of (this.config.plugins || [])) {
            let p = require(plugin);
            if (p.registerConsoleUIComponents) {
                p.registerConsoleUIComponents(this);
            }
        }
        for (let mname in this.modes) {
            await this.modes[mname].init();
        }
    }

    registerHomeKey(keys: string| string[], keyNames:string|string[], keyLabel:string, fn:()=>void, order = 1000) {
        return this.modes['home'].registerModeKey(keys, keyNames, keyLabel, fn, order);
    }
    // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
    async serverPollLoop(fn, minInterval = 300) {
        while (true) {
            let t1 = new Date().getTime();
            await fn();
            let t2 = new Date().getTime();
            let tDiff = t2 - t1;
            if (tDiff > 15000)
                tDiff = 15000; // in case something funky happens with the time, such as the computer goes on standby
            let waitTime = Math.max(minInterval, tDiff);
            await pasync.setTimeout(waitTime);
        }
    }
    async run() {
        try {
            await this.initLog();
        }
        catch (err) {
            console.error('Error initializing consoleui log', err, err.stack);
            process.exit(1);
        }
        let initStatus = await this.initClient();
        this.lastStatus = initStatus;
        this.axisLabels = initStatus!.controller!.axisLabels;
        this.usedAxes = initStatus!.controller!.usedAxes;
        this.initUI();
        await this.registerModules();
        this.setupPrimaryStatusBoxes();
        this.updatePrimaryStatusBoxes(initStatus);
        this.runStatusUpdateLoop();
        this.runMessageFetchLoop();
        this.activateMode('home');
        this.log('ConsoleUI Started');
    }
}
export default new ConsoleUI().run().catch((err) => console.error(err, err.stack));
