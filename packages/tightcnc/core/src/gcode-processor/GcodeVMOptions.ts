import { Controller } from '../controller';
import { AbstractServer } from '../AbstractServer';



export interface GcodeVMOptions {
    controller?: Controller;
    tightcnc?: AbstractServer;
    axisLabels?: string[];
    maxFeed?: number | number[];
    acceleration?: number | number[];
    minMoveTime?: number;
    noInit?: boolean;
    [key: string]: unknown;
}
