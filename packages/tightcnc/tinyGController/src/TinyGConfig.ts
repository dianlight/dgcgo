import { ControllerConfig } from '@dianlight/tightcnc-core';

export interface TinyGConfig extends ControllerConfig {
    // serial port settings
 //   port: string;
 //   baudRate: number;
 //   dataBits: number;
 //   stopBits: 1 | 0;
 //   parity: 'none';
    rtscts: boolean;
    xany: boolean;

    usedAxes: [boolean, boolean, boolean, boolean, boolean, boolean]; // which axes of xyzabc are actually used
    homableAxes: [boolean, boolean, boolean]; // which axes can be homed







    // This parameter governs how "aggressive" we can be with queueing data to the device.  The tightcnc controller
    // software already adjusts data queueing to make sure front-panel commands can be immediately handled, but
    // sometimes the tinyg seems to get desynced, and on occasion, it seems to crash under these circumstances
    // (with an error similar to "cannot get planner buffer").  If this is happening to you, try reducing this number.
    // The possible negative side effect is that setting this number too low may cause stuttering with lots of fast
    // moves.  Setting this to 4 is the equivalent of the tinyg "line mode" protocol.
    maxUnackedRequests: number;
};
