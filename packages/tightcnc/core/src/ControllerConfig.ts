
export interface ControllerConfig {
    port: string;
    baudRate: number;
    dataBits: number;
    stopBits: 1 | 0;
    parity: 'none';
    homableAxes?: [boolean, boolean, boolean];
    axisMaxFeeds?: number[];
    streamSendQueueHighWaterMark?: number;
    streamSendQueueLowWaterMark?: number;
    realTimeMovesMaxQueued?: number;
    realTimeMovesMaxOvershootFactor?: number;
}
