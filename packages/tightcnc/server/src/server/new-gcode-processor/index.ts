import TightCNCServer from "../tightcnc-server";
import { GcodeProcessor } from "./GcodeProcessor";
import GcodeVMProcessor from "./GcodeVMProcessor";


export function registerGcodeProcessors(tightcnc: TightCNCServer) {
    tightcnc.registerGcodeProcessor(/*'gcodevm',*/GcodeVMProcessor)
};
