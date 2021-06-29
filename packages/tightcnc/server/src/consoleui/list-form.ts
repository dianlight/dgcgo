import blessed from 'blessed';
import { Schema, createSchema } from 'common-schema';
import pasync from 'pasync';
import objtools from 'objtools';
import { ConsoleUI } from './consoleui';
export default class ListForm {

    consoleui: ConsoleUI | null
    screen: blessed.Widgets.Screen
    editorCancelled?: boolean

    constructor(consoleui:ConsoleUI|blessed.Widgets.Screen, private options = {}) {
        if (consoleui.screen && !(consoleui as any).setTerminal) {
            this.consoleui = consoleui as ConsoleUI;
            this.screen = consoleui.screen;
        }
        else {
            this.consoleui = null;
            this.screen = consoleui as blessed.Widgets.Screen;
        }
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async showEditor(container, schema, defaultVal?:any, options = {}) {
        if (!container && this.consoleui) {
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'c' implicitly has an 'any' type.
            return await this.consoleui.runInModal(async (c) => {
                return await this.showEditor(c, schema, defaultVal, options);
            });
        }
        if (!Schema.isSchema(schema))
            schema = createSchema(schema);
        let schemaData = schema.getData();
        if (defaultVal === undefined)
            defaultVal = schemaData.default;
        let [val, cancel] = await this._editValue(container, schemaData, defaultVal, options);
        this.editorCancelled = cancel || false;
        if (val === null || cancel) { // On cancel
            if ((options as any).returnDefaultOnCancel === false && !(options as any).returnValueOnCancel)
                return null;
            // Return default value only if default is valid
            try {
                if ((options as any).returnValueOnCancel && val !== null) {
                    val = schema.normalize(val);
                }
                else {
                    val = schema.normalize(defaultVal);
                }
            }
            catch (e) {
                return null;
            }
        }
        return val;
    }
    // @ts-expect-error ts-migrate(2705) FIXME: An async function or method in ES5/ES3 requires th... Remove this comment to see the full error message
    async _message(container, message, time = 2000) {
        let messageBox = blessed.box({
            border: {
                type: 'line'
            },
            content: message,
            align: 'center',
            valign: 'middle',
            width: message.length + 2,
            height: 3,
            top: 'center',
            left: 'center'
        });
        container.append(messageBox);
        this.screen.lockKeys = true;
        this.screen.render();
        await pasync.setTimeout(time);
        container.remove(messageBox);
        this.screen.lockKeys = false;
        this.screen.render();
    }
    // @ts-expect-error ts-migrate(7023) FIXME: '_editValue' implicitly has return type 'any' beca... Remove this comment to see the full error message
    async _editValue(container, schemaData, value, options = {}) {
        let r, cancel;
        options = objtools.deepCopy(options);
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
        (options as any).normalize = (val) => {
            return createSchema(schemaData).normalize(val);
        };
        try {
            if (value === null || value === undefined)
                value = schemaData.default;
            if (schemaData.editFn) {
                r = await schemaData.editFn(container, schemaData, value, options);
                cancel = r === null;
                if (Array.isArray(r)) {
                    cancel = r[1];
                    r = r[0];
                }
            }
            else if (schemaData.enum) {
                [r, cancel] = await this._enumSelector(container, schemaData.title || schemaData.label || (options as any).key || 'Select Value', schemaData.enum, value, options);
            }
            else if (schemaData.type === 'boolean') {
                r = await this.selector(container, schemaData.title || schemaData.label || (options as any).key || 'False or True', ['FALSE', 'TRUE'], value ? 1 : 0, options);
                cancel = r === null;
                if (r !== null)
                    r = !!r;
            }
            else if (schemaData.type === 'object') {
                [r, cancel] = await this._editObject(container, schemaData, value || {}, options);
            }
            else if (schemaData.type === 'array' && schemaData.isCoordinates) {
                [r, cancel] = await this._editCoordinates(container, schemaData, value || [0, 0, 0], options);
            }
            else if (schemaData.type === 'array') {
                [r, cancel] = await this._editArray(container, schemaData, value || [], options);
            }
            else if (schemaData.type === 'string') {
                r = await this.lineEditor(container, (schemaData.title || schemaData.label || (options as any).key || 'Value') + ':', value, options);
                cancel = r === null;
            }
            else if (schemaData.type === 'number') {
                // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'r' implicitly has an 'any' type.
                (options as any).normalize = (r) => {
                    if (!r.length || isNaN(r)) {
                        throw new Error('Must be valid number');
                    }
                    else {
                        return parseFloat(r);
                    }
                };
                r = await this.lineEditor(container, (schemaData.title || schemaData.label || (options as any).key || 'Value') + ':', value, options);
                cancel = r === null;
            }
            else if (schemaData.type === 'mixed') {
                [r, cancel] = await this._editMixed(container, schemaData, value, options);
            }
            else if (schemaData.type === 'map') {
                [r, cancel] = await this._editMap(container, schemaData, value || {}, options);
            }
            else {
                throw new Error('Unsupported edit schema type');
            }
            //if (r === null) r = value;
            if (r === null)
                return [null, cancel];
            r = createSchema(schemaData).normalize(r);
        }
        catch (err) {
            //this.screen.destroy();
            //console.log(err, err.stack);
            //process.exit(1);
            await this._message(container, err.message);
            if (this.consoleui)
                this.consoleui.log(err, err.stack);
            return await this._editValue(container, schemaData, value, options);
        }
        return [r, cancel];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async lineEditor(container, label, defaultValue = '', options = {}) {
        if (defaultValue === null || defaultValue === undefined)
            defaultValue = '';
        if (typeof defaultValue !== 'string')
            defaultValue = '' + defaultValue;
        if (this.consoleui)
            this.consoleui.pushHintOverrides([['Esc', 'Cancel'], ['Enter', 'Done']]);
        let outerBorder = blessed.box({
            width: (options as any).width || '80%',
            height: 5,
            top: (options as any).top || 'center',
            left: (options as any).left || '10%',
            border: { type: 'line' }
        });
        let labelBox = blessed.box({
            width: label.length,
            height: 1,
            align: 'center',
            content: label,
            top: 1,
            left: 0
        });
        outerBorder.append(labelBox);
        let innerBorder = blessed.box({
            width: '100%-' + (label.length + 2),
            height: 3,
            top: 0,
            left: label.length,
            border: { type: 'line' }
        });
        outerBorder.append(innerBorder);
        let textbox = blessed.textbox({
            inputOnFocus: true,
            height: 1,
            width: '100%-2'
        });
        innerBorder.append(textbox);
        container.append(outerBorder);
        textbox.focus();
        const cleanup = () => {
            if (this.consoleui)
                this.consoleui.popHintOverrides();
            innerBorder.remove(textbox);
            outerBorder.remove(innerBorder);
            container.remove(outerBorder);
            this.screen.render();
        };
        let waiter = pasync.waiter();
        textbox.on('cancel', () => {
            cleanup();
            waiter.resolve(null);
        });
        textbox.on('submit', () => {
            let value = textbox.getValue();
            if ((options as any).normalize) {
                try {
                    value = (options as any).normalize(value);
                }
                catch (err) {
                    this._message(container, err.message).then(() => textbox.focus());
                    if (this.consoleui)
                        this.consoleui.log(err, err.stack);
                    return;
                }
            }
            cleanup();
            waiter.resolve(value);
        });
        this.screen.render();
        textbox.setValue(defaultValue);
        this.screen.render();
        return waiter.promise;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    _getEntryDisplayLabel(key, value, schemaData) {
        if (!schemaData)
            schemaData = {};
        if (value === null || value === undefined)
            value = schemaData.default;
        if (value === undefined)
            value = null;
        let keyStr = '' + (schemaData.label || schemaData.description || key);
        if (typeof schemaData.shortDisplayLabel === 'function') {
            value = schemaData.shortDisplayLabel(value, key, schemaData);
        }
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            keyStr += ': ' + value;
        }
        else if (value && Array.isArray(value) && schemaData.isCoordinates) {
            let usedAxes = (this.consoleui && this.consoleui.usedAxes) || [true, true, true];
            keyStr += ': ' + value.filter((n, idx) => usedAxes[idx]).join(', ');
        }
        return keyStr;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _editCoordinates(container, schemaData, value, options = {}) {
        let coordObj = {};
        let coordObjSchema = {
            type: 'object',
            properties: {}
        };
        let axisLabels = (this.consoleui && this.consoleui.axisLabels) || ['x', 'y', 'z'];
        let usedAxes = (this.consoleui && this.consoleui.usedAxes) || [true, true, true];
        let maxNumAxes = Math.min(schemaData.coordinatesLength || 1000, axisLabels.length, usedAxes.length);
        for (let i = 0; i < maxNumAxes; i++) {
            if (usedAxes[i]) {
                let def = value && value[i];
                if (def === null || def === undefined)
                    def = (schemaData.default && schemaData.default[i]) || 0;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                coordObj[axisLabels[i].toUpperCase()] = def;
                // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                coordObjSchema.properties[axisLabels[i].toUpperCase()] = { type: 'number' };
            }
        }
        let extraKeys = [];
        if (this.consoleui) {
            extraKeys.push({
                hint: ['c', 'Use Current Pos'],
                keys: ['c'],
                // @ts-expect-error ts-migrate(7031) FIXME: Binding element 'data' implicitly has an 'any' typ... Remove this comment to see the full error message
                fn: ({ data }) => {
                    let pos = this.consoleui!.lastStatus!.controller!.pos;
                    for (let i = 0; i < maxNumAxes && i < pos.length; i++) {
                        if (usedAxes[i]) {
                            let v = pos[i];
                            if (typeof v === 'number') {
                                data[axisLabels[i].toUpperCase()] = v;
                            }
                        }
                    }
                }
            });
        }
        let [r, cancel] = await this._editObject(container, coordObjSchema, coordObj, { extraKeys });
        if (r === null)
            return [null, true];
        let newValue = [];
        for (let i = 0; i < maxNumAxes; i++) {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            let v = r[axisLabels[i].toUpperCase()] || 0;
            newValue.push(v);
        }
        return [newValue, cancel];
    }
    // @ts-expect-error ts-migrate(7023) FIXME: '_editMixed' implicitly has return type 'any' beca... Remove this comment to see the full error message
    async _editMixed(container, schemaData, value = null, options = {}) {
        // Show type selector
        let currentTypeNum;
        if (typeof value === 'string') {
            currentTypeNum = 0;
        }
        else if (typeof value === 'boolean') {
            currentTypeNum = 1;
        }
        else if (typeof value === 'number') {
            currentTypeNum = 2;
        }
        else if (Array.isArray(value)) {
            currentTypeNum = 3;
        }
        else if (value && typeof value === 'object') {
            currentTypeNum = 4;
        }
        else {
            value = null;
            currentTypeNum = null;
        }
        const typeLabelList = ['String', 'True/False', 'Number', 'List', 'Table (Object/Dict)'];
        let currentType = (currentTypeNum === null) ? null : typeLabelList[currentTypeNum];
        let selectedTypeNum = await this.selector(container, 'Edit As:' + (currentType ? (' (Currently ' + currentType + ')') : ''), typeLabelList, currentTypeNum || 0);
        if (selectedTypeNum === null) {
            if ((options as any).returnDefaultOnCancel === false)
                return [null, true];
            return [value, true];
        }
        // If changing type, reset value
        if (selectedTypeNum === 0 && typeof value !== 'string')
            // @ts-expect-error ts-migrate(2322) FIXME: Type '""' is not assignable to type 'null'.
            value = '';
        if (selectedTypeNum === 1 && typeof value !== 'boolean')
            // @ts-expect-error ts-migrate(2322) FIXME: Type 'false' is not assignable to type 'null'.
            value = false;
        if (selectedTypeNum === 2 && typeof value !== 'number')
            // @ts-expect-error ts-migrate(2322) FIXME: Type '0' is not assignable to type 'null'.
            value = 0;
        if (selectedTypeNum === 3 && !Array.isArray(value))
            // @ts-expect-error ts-migrate(2322) FIXME: Type 'never[]' is not assignable to type 'null'.
            value = [];
        if (selectedTypeNum === 4 && (!value || typeof value !== 'object'))
            // @ts-expect-error ts-migrate(2322) FIXME: Type '{}' is not assignable to type 'null'.
            value = {};
        // Make the subschema for the next type
        let stSchema = null;
        if (selectedTypeNum === 0)
            stSchema = { type: 'string', default: value };
        if (selectedTypeNum === 1)
            stSchema = { type: 'boolean', default: value };
        if (selectedTypeNum === 2)
            stSchema = { type: 'number', default: value };
        if (selectedTypeNum === 3)
            stSchema = { type: 'array', elements: { type: 'mixed' }, default: value };
        if (selectedTypeNum === 4)
            stSchema = { type: 'map', values: { type: 'mixed' }, default: value };
        // Show an editor
        // @ts-expect-error ts-migrate(7022) FIXME: 'newValue' implicitly has type 'any' because it do... Remove this comment to see the full error message
        let [newValue, cancel] = await this._editValue(container, stSchema, value, {});
        return [newValue, cancel];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _editArray(container, schemaData, value = [], options = {}) {
        if (!value)
            value = [];
        let elementsSchema = schemaData.elements;
        value = objtools.deepCopy(value || []);
        let title = schemaData.title || schemaData.label || (options as any).key || 'Edit Properties';
        let elementLabels = value.map((el, idx) => this._getEntryDisplayLabel(idx, el, elementsSchema));
        elementLabels.push(schemaData.doneLabel || '[Done]');
        options = objtools.deepCopy(options);
        (options as any).keys = [
            {
                hint: ['+', 'Add'],
                keys: ['+', '='],
                // @ts-expect-error ts-migrate(7031) FIXME: Binding element 'listBox' implicitly has an 'any' ... Remove this comment to see the full error message
                fn: ({ listBox, selected }) => {
                    if (selected > value.length)
                        return;
                    // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'any' is not assignable to parame... Remove this comment to see the full error message
                    value.splice(selected, 0, elementsSchema.default);
                    listBox.insertItem(selected, '');
                    for (let i = selected; i < value.length; i++) {
                        listBox.setItem(i, this._getEntryDisplayLabel(i, value[i], elementsSchema));
                    }
                    this.screen.render();
                }
            },
            {
                hint: ['Del', 'Remove'],
                keys: ['delete'],
                // @ts-expect-error ts-migrate(7031) FIXME: Binding element 'listBox' implicitly has an 'any' ... Remove this comment to see the full error message
                fn: ({ listBox, selected }) => {
                    if (selected >= value.length)
                        return;
                    value.splice(selected, 1);
                    listBox.removeItem(selected);
                    for (let i = selected; i < value.length; i++) {
                        listBox.setItem(i, this._getEntryDisplayLabel(i, value[i], elementsSchema));
                    }
                    this.screen.render();
                }
            }
        ];
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '(selected: any, listBox: any) =>... Remove this comment to see the full error message
        let r = await this.selector(container, title, elementLabels, 0, options, async (selected, listBox) => {
            if (selected >= value.length) {
                if ((options as any).normalize) {
                    try {
                        value = (options as any).normalize(value);
                    }
                    catch (err) {
                        this._message(container, err.message);
                        if (this.consoleui)
                            this.consoleui.log(err, err.stack);
                        return true;
                    }
                }
                return false;
            }
            let elementValue = value[selected];
            if (elementValue === null || elementValue === undefined)
                // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
                elementValue = elementsSchema.default;
            let opts = objtools.deepCopy(schemaData.formOptions || {});
            opts.key = selected;
            if (elementsSchema.actionFn) {
                try {
                    await elementsSchema.actionFn({
                        selectedIndex: selected,
                        selectedKey: selected,
                        selectedCurValue: elementValue,
                        opts,
                        listBox,
                        array: value
                    });
                }
                catch (err) {
                    await this._message(container, err.message);
                    if (this.consoleui)
                        this.consoleui.log(err, err.stack);
                }
                for (let i = 0; i < value.length; i++) {
                    listBox.setItem(i, this._getEntryDisplayLabel(i, value[i], elementsSchema));
                }
                this.screen.render();
                return true;
            }
            else {
                let [newValue, cancel] = await this._editValue(container, elementsSchema, elementValue, opts);
                if (newValue !== null) {
                    // @ts-expect-error ts-migrate(2322) FIXME: Type 'any' is not assignable to type 'never'.
                    value[selected] = newValue;
                    listBox.setItem(selected, this._getEntryDisplayLabel(selected, value[selected], elementsSchema));
                }
                this.screen.render();
                return true;
            }
        });
        let cancel = false;
        if (r === null) {
            cancel = true;
            if ((options as any).returnDefaultOnCancel === false)
                return [null, cancel];
            // NOTE: Hitting Esc while editing an object still counts as editing the object if fields
            // have been modified, unless the object fails validation
            if ((options as any).normalize) {
                try {
                    value = (options as any).normalize(value);
                }
                catch (e) {
                    return [null, cancel];
                }
            }
        }
        return [value, cancel];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _editMap(container, schemaData, value = {}, options = {}) {
        value = objtools.deepCopy(value);
        let title = schemaData.title || schemaData.label || (options as any).key || 'Edit Mapping';
        let mapKeys = Object.keys(value); // used to ensure consistent ordering
        let keyStrs = mapKeys.map((k) => {
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            return this._getEntryDisplayLabel(k, value[k], schemaData.values);
        });
        keyStrs.push(schemaData.doneLabel || '[Done]');
        options = objtools.deepCopy(options);
        (options as any).keys = [
            {
                hint: ['+', 'Add Key'],
                keys: ['+', '='],
                // @ts-expect-error ts-migrate(7031) FIXME: Binding element 'listBox' implicitly has an 'any' ... Remove this comment to see the full error message
                fn: ({ listBox, selected }) => {
                    this.lineEditor(container, 'New Key', '')
                        .then((key) => {
                        if (!key)
                            return;
                        if (key in value) {
                            this._message(container, 'Key already exists');
                            return;
                        }
                        mapKeys.push(key);
                        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        value[key] = (schemaData.values.default === undefined) ? null : schemaData.values.default;
                        // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        listBox.insertItem(mapKeys.length - 1, this._getEntryDisplayLabel(key, value[key], schemaData.values));
                        this.screen.render();
                    })
                        .catch((err) => {
                        this._message(container, '' + err);
                        if (this.consoleui)
                            this.consoleui.log(err, err.stack);
                    });
                }
            },
            {
                hint: ['Del', 'Remove'],
                keys: ['delete'],
                // @ts-expect-error ts-migrate(7031) FIXME: Binding element 'listBox' implicitly has an 'any' ... Remove this comment to see the full error message
                fn: ({ listBox, selected }) => {
                    if (selected >= mapKeys.length)
                        return;
                    let removedKey = mapKeys[selected];
                    mapKeys.splice(selected, 1);
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    delete value[removedKey];
                    listBox.removeItem(selected);
                    this.screen.render();
                }
            }
        ];
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '(selected: any, listBox: any) =>... Remove this comment to see the full error message
        let r = await this.selector(container, title, keyStrs, 0, options, async (selected, listBox) => {
            if (selected === mapKeys.length) {
                if ((options as any).normalize) {
                    try {
                        value = (options as any).normalize(value);
                    }
                    catch (err) {
                        this._message(container, err.message);
                        if (this.consoleui)
                            this.consoleui.log(err, err.stack);
                        return true;
                    }
                }
                return false;
            }
            let key = mapKeys[selected];
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            let curValue = value[key];
            if (curValue === null || curValue === undefined)
                curValue = schemaData.values.default;
            let opts = objtools.deepCopy(schemaData.formOptions || {});
            opts.key = key;
            if (schemaData.values.actionFn) {
                try {
                    await schemaData.values.actionFn({
                        selectedIndex: selected,
                        selectedKey: key,
                        selectedCurValue: curValue,
                        opts,
                        listBox,
                        obj: value
                    });
                }
                catch (err) {
                    await this._message(container, err.message);
                    if (this.consoleui)
                        this.consoleui.log(err, err.stack);
                }
                for (let i = 0; i < mapKeys.length; i++) {
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    listBox.setItem(i, this._getEntryDisplayLabel(mapKeys[i], value[mapKeys[i]], schemaData.values));
                }
                this.screen.render();
                return true;
            }
            else {
                let [newValue, cancel] = await this._editValue(container, schemaData.values, curValue, opts);
                if (newValue !== null) {
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    value[key] = newValue;
                    listBox.setItem(selected, this._getEntryDisplayLabel(key, newValue, schemaData.values));
                }
                this.screen.render();
                return true;
            }
        });
        let cancel = false;
        if (r === null) {
            cancel = true;
            if ((options as any).returnDefaultOnCancel === false)
                return [null, cancel];
            if ((options as any).normalize) {
                try {
                    value = (options as any).normalize(value);
                }
                catch (e) {
                    return [null, cancel];
                }
            }
        }
        return [value, cancel];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _editObject(container, schemaData, value = {}, options = {}) {
        value = objtools.deepCopy(value);
        // @ts-expect-error ts-migrate(7034) FIXME: Variable 'keysByIndex' implicitly has type 'any[]'... Remove this comment to see the full error message
        let keysByIndex = [];
        let keyNames = [];
        let keyStrs = [];
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
        const getEntryLabel = (key, value) => {
            return this._getEntryDisplayLabel(key, value, schemaData.properties[key]);
        };
        for (let key in schemaData.properties) {
            keysByIndex.push(key);
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            keyStrs.push(getEntryLabel(key, value[key]));
        }
        let title = schemaData.title || schemaData.label || (options as any).key || 'Edit Properties';
        keyStrs.push(schemaData.doneLabel || '[Done]');
        let totalNumItems = keyStrs.length;
        options = objtools.deepCopy(options);
        if (!(options as any).keys)
            (options as any).keys = [];
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'k' implicitly has an 'any' type.
        const addExtraKey = (k) => {
            let origFn = k.fn;
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'info' implicitly has an 'any' type.
            k.fn = (info) => {
                info.data = value;
                origFn(info);
                for (let i = 0; i < keysByIndex.length; i++) {
                    // @ts-expect-error ts-migrate(7005) FIXME: Variable 'keysByIndex' implicitly has an 'any[]' t... Remove this comment to see the full error message
                    info.listBox.setItem(i, getEntryLabel(keysByIndex[i], value[keysByIndex[i]]));
                }
                this.screen.render();
            };
            (options as any).keys.push(k);
        };
        if ((options as any).extraKeys) {
            for (let k of (options as any).extraKeys) {
                addExtraKey(k);
            }
        }
        // @ts-expect-error ts-migrate(2345) FIXME: Argument of type '(selected: any, listBox: any) =>... Remove this comment to see the full error message
        let r = await this.selector(container, title, keyStrs, 0, options, async (selected, listBox) => {
            if (selected === totalNumItems - 1) {
                if ((options as any).normalize) {
                    try {
                        value = (options as any).normalize(value);
                    }
                    catch (err) {
                        this._message(container, err.message);
                        if (this.consoleui)
                            this.consoleui.log(err, err.stack);
                        return true;
                    }
                }
                return false;
            }
            // @ts-expect-error ts-migrate(7005) FIXME: Variable 'keysByIndex' implicitly has an 'any[]' t... Remove this comment to see the full error message
            let key = keysByIndex[selected];
            // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            let curValue = value[key];
            if (curValue === null || curValue === undefined)
                curValue = schemaData.properties[key].default;
            let opts = objtools.deepCopy(schemaData.formOptions || {});
            opts.key = key;
            if (schemaData.properties[key].actionFn) {
                try {
                    await schemaData.properties[key].actionFn({
                        selectedIndex: selected,
                        selectedKey: key,
                        selectedCurValue: curValue,
                        opts,
                        listBox,
                        obj: value
                    });
                }
                catch (err) {
                    await this._message(container, err.message);
                    if (this.consoleui)
                        this.consoleui.log(err, err.stack);
                }
                for (let i = 0; i < keysByIndex.length; i++) {
                    // @ts-expect-error ts-migrate(7005) FIXME: Variable 'keysByIndex' implicitly has an 'any[]' t... Remove this comment to see the full error message
                    listBox.setItem(i, getEntryLabel(keysByIndex[i], value[keysByIndex[i]]));
                }
                this.screen.render();
                return true;
            }
            else {
                let [newValue, cancel] = await this._editValue(container, schemaData.properties[key], curValue, opts);
                if (newValue !== null) {
                    // @ts-expect-error ts-migrate(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    value[key] = newValue;
                    listBox.setItem(selected, getEntryLabel(key, newValue));
                }
                this.screen.render();
                return true;
            }
        });
        let cancel = false;
        if (r === null) {
            cancel = true;
            if ((options as any).returnDefaultOnCancel === false)
                return [null, cancel];
            // NOTE: Hitting Esc while editing an object still counts as editing the object if fields
            // have been modified, unless the object fails validation
            if ((options as any).normalize) {
                try {
                    value = (options as any).normalize(value);
                }
                catch (e) {
                    return [null, cancel];
                }
            }
        }
        return [value, cancel];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    async _enumSelector(container, title, values, defaultValue, options = {}) {
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'v' implicitly has an 'any' type.
        let strValues = values.map((v) => '' + v);
        let defaultIdx = (defaultValue === undefined) ? 0 : values.indexOf(defaultValue);
        if (defaultIdx === -1)
            defaultIdx = 0;
        let selectedIdx = await this.selector(container, title, strValues, defaultIdx, options);
        if (selectedIdx === null || selectedIdx === undefined)
            return [null, true];
        return [values[selectedIdx], false];
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'container' implicitly has an 'any' type... Remove this comment to see the full error message
    selector(container, title, items, defaultSelected = 0, options = {}, handler = null) {
        if (!container && this.consoleui) {
            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'c' implicitly has an 'any' type.
            return this.consoleui.runInModal(async (c) => {
                return await this.selector(c, title, items, defaultSelected, options, handler);
            });
        }
        // Container box
        let listContainer = blessed.box({
            width: (options as any).width || '100%',
            height: (options as any).height || '100%',
            top: (options as any).top || 0,
            left: (options as any).left || 0,
            border: { type: 'line' }
        });
        // Title line
        let titleBox = blessed.box({
            width: '100%',
            height: 1,
            align: 'center',
            content: title
        });
        listContainer.append(titleBox);
        // List to select options
        let listBox = blessed.list({
            style: (options as any).style || {
                selected: {
                    inverse: true
                },
                item: {
                    inverse: false
                }
            },
            keys: true,
            items: items,
            width: '100%-2',
            height: '100%-3',
            top: 1,
            border: { type: 'line' }
        });
        listBox.select(defaultSelected);
        listContainer.append(listBox);
        container.append(listContainer);
        listBox.focus();
        if (this.consoleui) {
            let hints:[string,string][] = [['Esc', 'Cancel'], ['Up/Down', 'Select'], ['Enter', 'Done']];
            if ((options as any).keys) {
                for (let el of (options as any).keys) {
                    if (el.hint)
                        hints.push(el.hint);
                }
            }
            this.consoleui.pushHintOverrides(hints);
        }
        let waiter = pasync.waiter();
        // Need to support 2 modes:
        // Either select a single option then resolve, or allow repeated calls to a handler, and exit on handler return false or cancel (escape)
        const cleanup = () => {
            if (this.consoleui)
                this.consoleui.popHintOverrides();
            listContainer.remove(listBox);
            container.remove(listContainer);
            this.screen.render();
        };
        listBox.on('select', () => {
            let selected = listBox.index;
            if (handler) {
                try {
                    // @ts-expect-error ts-migrate(2531) FIXME: Object is possibly 'null'.
                    let r = handler(selected, listBox);
                    if (r === false) {
                        cleanup();
                        waiter.resolve(selected);
                    }
                    else if (r && typeof r.then === 'function') {
                        r
                            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'r' implicitly has an 'any' type.
                            .then((r) => {
                            if (r === false) {
                                cleanup();
                                waiter.resolve(listBox.index);
                            }
                            else {
                                listBox.focus();
                            }
                        })
                            // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'err' implicitly has an 'any' type.
                            .catch((err) => {
                            cleanup();
                            waiter.reject(err);
                        });
                    }
                    else {
                        listContainer.focus();
                    }
                }
                catch (err) {
                    cleanup();
                    waiter.reject(err);
                }
            }
            else {
                cleanup();
                waiter.resolve(selected);
            }
        });
        listBox.once('cancel', () => {
            cleanup();
            waiter.resolve(null);
        });
        // Custom keys
        if ((options as any).keys) {
            for (let el of (options as any).keys) {
                if (el.keys && el.fn) {
                    listBox.key(el.keys, () => {
                        el.fn({
                            container,
                            listBox,
                            selected: listBox.index
                        });
                    });
                }
            }
        }
        this.screen.render();
        return waiter.promise;
    }
    // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'schemaData' implicitly has an 'any' typ... Remove this comment to see the full error message
    _makeFormEl(schemaData, values, options = {}) {
        if (schemaData.type !== 'object')
            throw new Error('Must be object');
        // Container box for this form
        let listContainer = blessed.box({
            width: (options as any).width,
            height: (options as any).height,
            top: (options as any).top,
            left: (options as any).left,
            border: { type: 'line' }
        });
        // Title line
        // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'title'.
        if (!title)
            // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'title'.
            title = schema.title || schema.description || 'Select Option';
        let titleBox = blessed.box({
            width: '100%',
            height: 1,
            align: 'center',
            // @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'title'.
            content: title
        });
        listContainer.append(titleBox);
        // Determine the set of list items (stuff from schema, plus Done button)
        // Each item can be read only (determined by readOnly flag on schema).  Types are each handled differently.
        // If a schema entry contains an 'action' property, that function is run instead of editing
        // @ts-expect-error ts-migrate(7034) FIXME: Variable 'listEntryStrings' implicitly has type 'a... Remove this comment to see the full error message
        let listEntryStrings = [];
        let listEntryActions = [];
        // @ts-expect-error ts-migrate(7006) FIXME: Parameter 'str' implicitly has an 'any' type.
        const addListEntry = (str, subschema, action) => {
        };
        // List to select options
        let listBox = blessed.list({
            style: (options as any).style || {
                selected: {
                    inverse: true
                },
                item: {
                    inverse: false
                }
            },
            keys: true,
            // @ts-expect-error ts-migrate(7005) FIXME: Variable 'listEntryStrings' implicitly has an 'any... Remove this comment to see the full error message
            items: listEntryStrings,
            width: '100%-2',
            height: '100%-3',
            top: 1,
            border: { type: 'line' }
        });
    }
}
/*
var screen = blessed.screen({
    smartCSR: true
});

let schema = {
    type: 'object',
    label: 'Edit my object',
    properties: {
        strtest: {
            type: 'string',
            default: 'bar',
            label: 'Test String',
            validate(val) {
                if (val === 'foo') throw new Error('Val cant be foo');
            }
        },
        btest: {
            type: 'boolean',
            label: 'Test Boolean'
        },
        entest: {
            type: 'string',
            default: 'ZAP',
            label: 'Test Enum',
            enum: [ 'ZIP', 'ZAP', 'ZOOP' ]
        },
        ntest: {
            type: 'number',
            default: 3
        },
        subobj: {
            prop1: String,
            prop2: Number
        },
        artest: { type: 'array', elements: Number, default: [ 1, 2, 3 ] },
        maptest: {
            type: 'map',
            values: String,
            default: { foo: 'bar', biz: 'baz' }
        },
        mixed: {
            type: 'mixed'
        },
        coor: {
            type: [ Number ],
            isCoordinates: true,
            default: [ 1, 2, 3 ]
        }
    }
};

let lf = new ListForm(screen);

lf.showEditor(screen, schema)
    .then((r) => {
        screen.destroy();
        console.log('Result', r);
        process.exit(0);
    }, (err) => {
        screen.destroy();
        console.error('Error', err);
        process.exit(1);
    });
*/
