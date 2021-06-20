//import { ControllerStatus, StatusObject } from 'app/../tightcnc/types/src';
import { Client } from 'src/tightcnc/TightCNC';
import { ActionTree, ActionContext } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';

const actions: ActionTree<TightCNCStateInterface, StateInterface> = {
 clientStatus (context: ActionContext<TightCNCStateInterface, StateInterface> ,client:Client) {
    if (client) {
      setTimeout(() => {
        client.getStatus().then((result) => {
          context.commit('setLastStatus', result)
          void context.dispatch('clientStatus', client)
        }).catch((err:Error) => {
          console.error(err);
          context.commit('setController', undefined) 
          void context.dispatch('clientStatus', client)
        });
      }, 500)
    }
  },
  logReader(context: ActionContext<TightCNCStateInterface, StateInterface>, client: Client) {
    if (client) {
      client.getLog('comms', context.state.logs.lastReceivedLine+1, undefined, context.state.logs.options.bufferSize).then((result) => {
        if(result.length > 0)context.commit('addLogs', result)
        setTimeout(() => {
          void context.dispatch('logReader', client)
        }, context.state.logs.options.bufferSize - result.length)
        if (context.state.logs.options.bufferSize - result.length < 250) {
          console.warn(`Log reading speed very hight ${context.state.logs.options.bufferSize - result.length}ms`)          
        }
      }).catch((err:Error) => {
        console.error(err);
        setTimeout(() => {
          void context.dispatch('logReader', client)
        }, 5000)
      });
    }
  }
};

export default actions;
