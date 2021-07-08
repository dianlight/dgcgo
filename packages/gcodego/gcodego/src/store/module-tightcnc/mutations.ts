import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import {  StatusObject } from '@dianlight/tightcnc-core'
import { ControllerStatus, JobStatus } from '@dianlight/tightcnc-core'
import { LogLine } from '@dianlight/gcodego-core';
//import { Notify } from 'quasar'


const mutation: MutationTree<TightCNCStateInterface> = {
  setController(state: TightCNCStateInterface, controller: ControllerStatus) {
    if (state.lastStatus) {
      state.lastStatus.controller = controller
    }
  },
  setLastStatus(state: TightCNCStateInterface, status: StatusObject) {
    state.lastStatus = status
  },
  setJobStatus(state: TightCNCStateInterface, status: JobStatus) {
    if (state.lastStatus)
      state.lastStatus.job = status
  },
  setLogOptions(state: TightCNCStateInterface, options: {
    bufferSize?: number
    filterStatus?: boolean
    matchStatus?: boolean
    autoScroll?: boolean
  }) {
    Object.assign(state.logs.options, options)
  },
  setLogLastVisualizedLine(state: TightCNCStateInterface, line: number) {
    state.logs.lastVisualizedLine = line
  },
  addLogs(state: TightCNCStateInterface, lines: LogLine[]) {
    //     console.log('Ricevute:',lines.length,lines[0].line, lines[lines.length-1].line,lines)
    state.logs.lines.push(...lines
      .map(log => {
        state.logs.lastReceivedLine = log.line
        return log
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .reduce<LogLine[]>((previousValue: LogLine[], currentValue: LogLine, _currentIndex: number, _all: LogLine[]) => {
        if (state.logs.options.matchStatus && currentValue.direction === '<' && (currentValue.data === 'ok' || currentValue.data.startsWith('error:'))) {
          //  console.log('Response!',currentValue,currentIndex)
          let match = false;
          // Search in previus 100 lines
          for (const value of state.logs.lines.slice(state.logs.lines.length - 100).filter(dv => dv.direction === '>')) {
            if (!value.result) {
              // console.log('Setting on line:',value,currentValue.data)
              value.result = currentValue.data
              match = true
              break
            }
          }
          if (!match) {
            for (const value of previousValue.filter(dv => dv.direction === '>')) {
              if (!value.result) {
                //  console.log('Setting on line:',value,currentValue.data)
                value.result = currentValue.data
                match = true
                break
              }
            }
            if (!match) {
              previousValue.push(currentValue)
            }
          }
        } else if (state.logs.options.matchStatus && currentValue.direction == '@') {
          let match = false
          // Search in previus 100 lines
          for (const value of state.logs.lines.slice(state.logs.lines.length - 100).filter(dv => dv.direction === '>')) {
            if (value.result?.startsWith('error:')) {
              value.error = currentValue.data
              match = true
              break
            }
          }
          if (!match) {
            for (const value of previousValue.filter(dv => dv.direction === '>')) {
              if (value.result?.startsWith('error:')) {
                value.error = currentValue.data
                match = true
                break
              }
            }
            if (!match) {
              previousValue.push(currentValue)
            }
          }
        } else {
          previousValue.push(currentValue)
        }
        return previousValue;
      }, [] as LogLine[])
      .filter((log) => {
        /*
        if (log.direction === '<' && log.data.startsWith('[MSG:')) {
          Notify.create({
            type: 'info',
            multiLine: true,
            message: log.data.match(/\[MSG:(.*)]/ig) as unknown as string,
            position: 'top-right',
            timeout: 30000
          })
        }
        */

        if (state.logs.options.filterStatus) {
          return !(log.direction === '%' || log.data.indexOf('(sync)') > 0)
        }
        else return true;
      })
    );
  }
};

export default mutation;