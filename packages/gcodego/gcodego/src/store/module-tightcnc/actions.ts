import { ActionTree, ActionContext } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';
import {TightCNCClient} from 'tightcnc'

const actions: ActionTree<TightCNCStateInterface, StateInterface> = {
 clientStatus (context: ActionContext<TightCNCStateInterface, StateInterface> ,client:TightCNCClient) {
    context.commit('setClient', client);
    if (client) {
      setTimeout(() => {
        client.op<TightCNCClient>('getStatus').then((result) => {
          console.log(result)
          context.commit('setLastStatus', result)
          void context.dispatch('clientStatus', client)
        }).catch((err) => {
          console.error(err);
          //context.commit('setLastError', err)
          void context.dispatch('clientStatus', client)
        });
      }, 5000)
    }
  }
};

export default actions;
