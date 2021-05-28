import { ActionTree, ActionContext } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';
import * as TightCNC from '../../tightcnc/TightCNC'

const actions: ActionTree<TightCNCStateInterface, StateInterface> = {
 clientStatus (context: ActionContext<TightCNCStateInterface, StateInterface> ,client:TightCNC.Client) {
    context.commit('setClient', client);
    if (client) {
      setTimeout(() => {
        client.op<{error:unknown,result:TightCNC.Client}>('getStatus').then((result) => {
          console.log(result.result,result.error)
          context.commit('setLastStatus', result.result)
          void context.dispatch('clientStatus', client)
        }).catch((err) => {
          console.error(err);
          //context.commit('setLastError', err)
          void context.dispatch('clientStatus', client)
        });
      }, 1000)
    }
  }
};

export default actions;
