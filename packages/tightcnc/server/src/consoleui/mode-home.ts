import blessed from 'blessed';
import { ConsoleUI } from './consoleui';
import ModeControl from './mode-control';
export default class ModeHome extends ModeControl {

    constructor(consoleui: ConsoleUI) {
        super(consoleui);
    }
    override init() {
        super.init();
        //this.box.setContent('Home screen');
        let text = blessed.box({
            top: '50%',
            width: '100%',
            height: '100%',
            content: 'TightCNC ConsoleUI',
            align: 'center'
        });
        this.box.append(text);
        this.registerHomeKey(['escape', 'q'], 'Esc', 'Exit', () => process.exit(0), 0);
    }
    override activateMode() {
        super.activateMode();
    }
    override exitMode() {
        super.exitMode();
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'keys' implicitly has an 'any' type.
    registerHomeKey(keys, keyNames, keyLabel, fn, order = 1000) {
        return this.registerModeKey(keys, keyNames, keyLabel, fn, order);
    }
}

export function registerConsoleUI(consoleui:ConsoleUI) {
    consoleui.registerMode('home', new ModeHome(consoleui));
};
