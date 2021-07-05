export interface WorkBenchSessionData {
    id:string,
    name:string, // Tab Name
    fileName: string,
    fullPath: string,
    gcode?:string,
    tmpFileName?:string
}