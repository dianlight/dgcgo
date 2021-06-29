import blessed from 'blessed';
import CrispHooks from 'crisphooks';
import { ConsoleUI } from './consoleui'
export default class ConsoleUIMode extends CrispHooks {

    modeHints: {
        keyNames: any
        order: number
        label: any
    }[] = [];
    activeModeHints:string[] = [];
    modeIsActive = false;
    box:blessed.Widgets.BoxElement

    constructor(public consoleui:ConsoleUI) {
        super();
        this.box = blessed.box({
            width: '100%',
            height: '100%',
            tags: true
        });
    }
    /**
     * Called once all modes have been registered, in registration order.
     */
    init() {
    }
    /**
     * Registers a hint to be automatically activated when the mode is activated, and deactivated when the mode is exited.
     */
    registerModeHint(keyNames:string | string[], label:string, order = 1000) {
        let pos = this.modeHints.length;
        for (let i = 0; i < this.modeHints.length; i++) {
            if (this.modeHints[i].order > order) {
                pos = i;
                break;
            }
        }
        this.modeHints.splice(pos, 0, { keyNames, label, order });
        this._refreshModeHints();
        return this.modeHints[pos];
    }

    removeModeHint(hint:{
        keyNames: any;
        order: number;
        label: any;
    }) {
        this.modeHints = this.modeHints.filter((h) => h !== hint);
        this._refreshModeHints();
    }
    registerModeKey(keys:string|string[], keyNames:string|string[], keyLabel:string, fn:(ch: any, key: blessed.Widgets.Events.IKeyEventArg) => void, order = 1000) {
        const tr = typeof keys
        if (!Array.isArray(keys))
            keys = [keys];
        let hint = this.registerModeHint(keyNames, keyLabel, order);
        this.box.key(keys, fn);
        return { hint, keys:tr, fn };
    }
    removeModeKey(mkey: {
        hint: any
        keys: string
        fn: (ch: any, key: blessed.Widgets.Events.IKeyEventArg) => void
    }) {
        this.removeModeHint(mkey.hint);
        this.box.unkey(mkey.keys, mkey.fn);
    }
    _refreshModeHints() {
        if (!this.modeIsActive)
            return;
        for (let hint of this.activeModeHints) {
            this.consoleui.removeHint(hint);
        }
        this.activeModeHints = [];
        for (let modeHint of this.modeHints) {
            let hint = this.consoleui.addHint(modeHint.keyNames, modeHint.label);
            this.activeModeHints.push(hint);
        }
    }
    /**
     * Called by ConsoleUI() as part of mode activation.  Responsible for filling consoleui.mainPane.
     */
    activateMode() {
        for (let modeHint of this.modeHints) {
            let hint = this.consoleui.addHint(modeHint.keyNames, modeHint.label);
            this.activeModeHints.push(hint);
        }
        this.consoleui!.mainPane?.append(this.box);
        this.box.focus();
        this.modeIsActive = true;
    }
    /**
     * Called by ConsoleUI when the mode is exited.  Must clean up after the mode.
     */
    exitMode() {
        this.modeIsActive = false;
        for (let hint of this.activeModeHints) {
            this.consoleui.removeHint(hint);
        }
        this.activeModeHints = [];
        this.consoleui!.mainPane?.remove(this.box);
    }
}
