import EventEmitter from 'events';

export class GlobalEventBus extends EventEmitter {
    public static NEW_MENU = Symbol('new-menu')
    public static DEL_MENU = Symbol('del-menu')
    public static NEW_ROUTE = Symbol('new-route')
    public static DEL_ROUTE = Symbol('del-route')
    public static NOTIFY = Symbol('notify')
    public static DIALOG = Symbol('dialog')
    public static DIALOG_RESULT = Symbol('dialog-result')
}