import blessed from 'blessed';
import { ConsoleUI } from './consoleui';
import ModeControl from './mode-control';
function formatMinutes(secs: any) {
    let hours = Math.floor(secs / 3600);
    let minutes = Math.floor((secs - hours * 3600) / 60);
    if (minutes < 10)
        // @ts-expect-error ts-migrate(2322) FIXME: Type 'string' is not assignable to type 'number'.
        minutes = '0' + minutes;
    return '' + hours + ':' + minutes;
}
export default class ModeJobInfo extends ModeControl /*ConsoleUIMode*/ {

    infoTextbox?: blessed.Widgets.BoxElement
    statusUpdateHandler: (param: any)=>void

    constructor(consoleui: ConsoleUI) {
        super(consoleui);
        this.statusUpdateHandler = (status) => {
            let text = this.getStatusText(status);
            this.infoTextbox?.setContent(text);
            this.consoleui.render();
        };
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'status' implicitly has an 'any' type.
    getStatusText(status) {
        if (!status.job)
            return 'No current job.';
        let text = '';
        text += 'Job state: ' + status.job.state + '\n';
        text += 'Start time: ' + status.job.startTime + '\n';
        if (status.job.progress) {
            text += 'Progress: ' + status.job.progress.percentComplete.toFixed(1) + '%\n';
            text += 'Time running: ' + formatMinutes(status.job.progress.timeRunning) + '\n';
            text += 'Est. time remaining: ' + formatMinutes(status.job.progress.estTimeRemaining) + '\n';
        }
        if (status.job.gcodeProcessors && status.job.gcodeProcessors['final-job-vm']) {
            let vmStatus = status.job.gcodeProcessors['final-job-vm'];
            text += 'Units: ' + vmStatus.units + '\n';
            if (vmStatus.line)
                text += 'GCode line number: ' + vmStatus.line + '\n';
            text += 'Lines processed: ' + vmStatus.lineCounter + '\n';
        }
        let textObj = { text }; // wrap this is an object so it can be modified by the hook (by reference)
        this.triggerSync('buildStatusText', textObj);
        text = textObj.text;
        if (status.job.state === 'error' && status.job.error) {
            text += 'Error: ' + JSON.stringify(status.job.error) + '\n';
        }
        return text;
    }
    override activateMode() {
        super.activateMode();
        this.consoleui.on('statusUpdate', this.statusUpdateHandler);
        this.statusUpdateHandler(this.consoleui.lastStatus);
    }
    override exitMode() {
        this.consoleui.removeListener('statusUpdate', this.statusUpdateHandler);
        super.exitMode();
    }
    override init() {
        super.init();
        this.infoTextbox = blessed.box({
            width: '100%',
            height: '100%',
            content: '',
            align: 'center',
            valign: 'middle',
            tags: true
        });
        this.box.append(this.infoTextbox);
        this.consoleui.registerHomeKey(['j', 'J'], 'j', 'Job Info', () => this.consoleui.activateMode('jobInfo'), 4);
        this.registerModeKey(['escape'], ['Esc'], 'Home', () => this.consoleui.exitMode(), 0);
        // Pull in a few useful keybinds from the control mode
        let controlKeybinds = this.consoleui.config.consoleui.control.keybinds;
        let controlMode = this.consoleui.modes.control;
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'kb' implicitly has an 'any' type.
        const registerKeybind = (kb) => {
            this.registerModeKey(kb.keys, kb.keyNames, kb.label, () => {
                controlMode._executeKeybind(kb.action)
                    .catch((err) => this.consoleui.clientError(err));
            }, 10);
        };
        for (let key of ['hold', 'resume', 'cancel']) {
            if (controlKeybinds[key]) {
                registerKeybind(controlKeybinds[key]);
            }
        }
    }
}

export function registerConsoleUI(consoleui: ConsoleUI) {
    consoleui.registerMode('jobInfo', new ModeJobInfo(consoleui));
};
