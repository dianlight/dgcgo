import blessed from 'blessed';
import { ConsoleUI } from './consoleui';
import ModeControl from './mode-control';
export default class ModeLog extends ModeControl {
    updateLoopRunning = false;
    modeActive = false;
    logConfig:any;
    lastLineNum?:number;
    logStr = '';
    textbox?: blessed.Widgets.TextboxElement
    logBox?: blessed.Widgets.BoxElement
    separatorLine ?: blessed.Widgets.LineElement

    constructor(consoleui:ConsoleUI) {
        super(consoleui);
        this.logConfig = consoleui.config.consoleui.log;
    }
    async updateLog():Promise<boolean> {
        let request = {
            start: (this.lastLineNum === undefined) ? 0 : (this.lastLineNum + 1),
            end: null,
            limit: this.logConfig.updateBatchLimit
        };
        let newEntries = await this.consoleui.client?.op<[number,string][]>('getLog', request);
        if (!newEntries!.length)
            return false;
        let firstLineNum = newEntries![0][0];
        let lastLineNum = newEntries![newEntries!.length - 1][0];
        if (this.lastLineNum !== undefined && firstLineNum !== this.lastLineNum + 1) {
            // Either server log indexes reset, or we missed a gap in log data
            this.logStr = '';
        }
        for (let entry of newEntries!) {
            this.logStr += entry[1] + '\n';
        }
        this.lastLineNum = newEntries![newEntries!.length - 1][0];
        if (this.logStr.length > this.logConfig.bufferMaxSize) {
            this.logStr = this.logStr.slice(-this.logConfig.bufferMaxSize);
        }
        return true;
    }
    refreshLogDisplay() {
        this.logBox?.setContent(this.logStr);
        if (this.logStr)
            this.logBox?.setScrollPerc(100);
        this.consoleui.render();
    }
    startLogUpdateLoop() {
        if (this.updateLoopRunning)
            return;
        this.updateLoopRunning = true;
        const runLoop = async () => {
            await this.consoleui.serverPollLoop(async () => {
                try {
                    let updated = await this.updateLog();
                    if (this.modeActive && updated) {
                        this.refreshLogDisplay();
                    }
                }
                catch (err) {
                    this.consoleui.clientError(err);
                }
            }, this.logConfig.updateInterval);
        };
        runLoop().catch(this.consoleui.clientError.bind(this));
    }
    override activateMode() {
        super.activateMode();
        this.modeActive = true;
        if (!this.updateLoopRunning)
            this.startLogUpdateLoop();
        this.textbox?.focus();
    }
    override exitMode() {
        this.modeActive = false;
        super.exitMode();
    }
    override init() {
        super.init();
        this.logBox = blessed.box({
            width: '100%',
            height: '100%-2',
            content: 'Foo\nBar\n',
            scrollable: true,
            scrollbar: {
                ch: '#',
                style: {
                //fg: 'blue'
                },
                track: {
                    bg: 'gray'
                }
            },
            style: {}
        });
        this.box.append(this.logBox);
        this.separatorLine = blessed.line({
            type: 'line',
            orientation: 'horizontal',
            width: '100%',
            bottom: 1
        });
        this.box.append(this.separatorLine);
        this.textbox = blessed.textbox({
            inputOnFocus: true,
            height: 1,
            width: '100%',
            bottom: 0
        });
        this.box.append(this.textbox);
        const scrollUp = () => {
            this.logBox?.scroll(-Math.ceil( parseInt(this.logBox.height as string) / 3));
            this.consoleui.render();
        };
        const scrollDown = () => {
            this.logBox?.scroll(Math.ceil( parseInt(this.logBox.height as string) / 3));
            this.consoleui.render();
        };
        this.consoleui.registerHomeKey(['l', 'L'], ['l'], 'Log Mode', () => this.consoleui.activateMode('log'), 2);
        this.registerModeKey(['escape'], ['Esc'], 'Home', () => this.consoleui.exitMode());
        this.registerModeKey(['pageup'], ['PgUp'], 'Scroll Up', scrollUp);
        this.registerModeKey(['pagedown'], ['PgDn'], 'Scroll Down', scrollDown);
        this.registerModeHint(['<Any>'], 'Type');
        this.registerModeHint(['Enter'], 'Submit');
        this.textbox.key(['escape'], () => this.consoleui.exitMode());
        this.textbox.key(['pageup'], scrollUp);
        this.textbox.key(['pagedown'], scrollDown);
        this.textbox.on('submit', () => {
            let line = this.textbox?.getValue();
            this.textbox?.clearValue();
            this.textbox?.focus();
            this.consoleui.render();
            if (line!.trim()) {
                this.consoleui.client?.op('send', {
                    line: line
                })
                    .catch((err) => {
                    this.consoleui.clientError(err);
                });
            }
        });
    }
}

export function registerConsoleUI(consoleui: ConsoleUI) {
    consoleui.registerMode('log', new ModeLog(consoleui));
};
