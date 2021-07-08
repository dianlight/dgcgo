import TightCNCServer from "../tightcnc-server";
import GcodeVMProcessor from "./GcodeVMProcessor";


export function registerGcodeProcessors(tightcnc: TightCNCServer) {
    tightcnc.registerGcodeProcessor(/*'gcodevm',*/GcodeVMProcessor)
};
