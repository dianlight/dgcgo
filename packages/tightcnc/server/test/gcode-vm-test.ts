const GcodeLine = require('../lib/gcode-line');
const GcodeVM = require('../lib/gcode-processors/gcode-vm');
/*
let testGcode = [
    'G54',
    'G10 P1 L2 X10 Y10 Z-10',
    'F10',
    'G1 X0 Y0 Z0'
];
*/
let testGcode = [
    'G0 Z15',
    'X10 Y10',
    'Z5',
    'X20 Y20'
];
let vm = new GcodeVM();
(vm as any).initProcessor();
for (let str of testGcode) {
    console.log('>>>>> ' + str);
    let line = new GcodeLine(str);
    line = (vm as any).processGcode(line);
    console.log('Before:');
    console.log((line as any).before);
    console.log('After:');
    console.log((line as any).after);
    console.log('Is Motion: ' + (line as any).isMotion);
    console.log('');
}
