import { Client } from 'src/tightcnc/TightCNC';
import { ActionTree, ActionContext } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';

const actions: ActionTree<TightCNCStateInterface, StateInterface> = {
 clientStatus (context: ActionContext<TightCNCStateInterface, StateInterface> ,client:Client) {
    //context.commit('setClient', client);
    if (client) {
      setTimeout(() => {
        client.getStatus().then((result) => {
          //console.log(result)
          context.commit('setLastStatus', result)
          void context.dispatch('clientStatus', client)
        }).catch((err) => {
          console.error(err);
          //context.commit('setLastError', err)
          void context.dispatch('clientStatus', client)
        });
      }, 500)
    }
  }
};

export default actions;
