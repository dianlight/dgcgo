import { ControllerConfig } from "@dianlight/tightcnc-core";

export interface GrblConfig extends ControllerConfig {
    usedAxes: [boolean, boolean, boolean];
    homableAxes: [boolean, boolean, boolean];
    statusUpdateInterval?: number    
}
