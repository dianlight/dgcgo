import { ConsoleUI } from './consoleui';
import JobOption from './job-option';
//const blessed = require('blessed');
import ListForm from './list-form';
export default class JobOptionRawfile extends JobOption {
    /**
     * This method is called when the option is selected in the job creation UI.  It
     * should handle any configuration for the option.
     *
     * @method optionSelected
     */
    override async optionSelected() {
        let form = new ListForm((this as any).consoleui);
        (this as any).rawFile = await form.showEditor(null, { type: 'boolean', label: 'Raw File Sending Enabled' }, !!(this as any).rawFile);
    }
    /**
     * This method should handle adding whatever this job option needs to the jobOptions
     * object sent to the server.  It should use state information that was collected
     * in optionSelected().
     *
     * @method addToJobOptions
     * @param {Object} obj - jobOptions object to be sent to the server
     */
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'obj' implicitly has an 'any' type.
    addToJobOptions(obj) {
        if ((this as any).rawFile)
            obj.rawFile = true;
    }
    /**
     * Return a string to append to the job configuration display.
     *
     * @method getDisplayString
     * @return {String}
     */
    override getDisplayString():string|null {
        if (!(this as any).rawFile)
            return null;
        return 'Send Raw File: On';
    }
}

module.exports.registerConsoleUI = (consoleui: ConsoleUI) => {
    consoleui.registerJobOption('Send Raw File (No Analysis)', JobOptionRawfile);
};
