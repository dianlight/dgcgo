import { LogLine } from '@dianlight/gcodego-core';
import { StatusObject } from '@dianlight/tightcnc-core'


export interface TightCNCStateInterface {
  lastStatus?: StatusObject
  logs: {
    options: {
      bufferSize: number
      filterStatus: boolean
      filterControl: boolean
      matchStatus: boolean
      autoScroll: boolean
    },
    lines: LogLine[]
    lastReceivedLine: number,
    lastVisualizedLine: number
  }
}

function state(): TightCNCStateInterface {
  return {
    logs: {
      options: {
        bufferSize: 1000,
        filterStatus: true,
        filterControl: true,
        matchStatus: true,
        autoScroll: true
      },
      lines: [],
      lastReceivedLine: -1000,
      lastVisualizedLine: -1
    }
  }
}

export default state;
