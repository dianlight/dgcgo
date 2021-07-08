
export type TightCNCGrblConfig = {
    // serial port settings
    port: string; // '/dev/ttyACM1',
    baudRate: number;
    dataBits: number;
    stopBits: 1 | 0;
    parity: 'none';

    usedAxes: [boolean, boolean, boolean];
    homableAxes: [boolean, boolean, boolean];
};
