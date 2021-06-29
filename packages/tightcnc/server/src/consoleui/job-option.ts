import { ConsoleUI } from "./consoleui";

/**
 * This class handles the ConsoleUI client side component of job options.  It is modular so
 * modules can register UIs for any provided job options.
 *
 * This class is instantiated each time the option is selected, so can store state data
 * related to the option.
 *
 * @class JobOption
 */
export default abstract class JobOption {
    public newJobMode: any;

    constructor(public consoleui: ConsoleUI) {
        this.newJobMode = consoleui.modes.newJob;
    }
    /**
     * This method is called when the option is selected in the job creation UI.  It
     * should handle any configuration for the option.
     *
     * @method optionSelected
     */
    abstract optionSelected():Promise<void>;
    /**
     * This method should handle adding whatever this job option needs to the jobOptions
     * object sent to the server.  It should use state information that was collected
     * in optionSelected().
     *
     * @method addToJobOptions
     * @param {Object} obj - jobOptions object to be sent to the server
     */
    abstract addToJobOptions(obj:any):void
    /**
     * Return a string to append to the job configuration display.
     *
     * @method getDisplayString
     * @return {String}
     */
    abstract getDisplayString():string|null 
}
