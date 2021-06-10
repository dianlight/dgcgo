//import { ControllerStatus, StatusObject } from 'app/../tightcnc/types/src';
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
        }).catch((err:Error) => {
          console.error(err);
          context.commit('setController', undefined) 
          /*
          const errorStatus = JSON.parse(JSON.stringify(context.state.lastStatus)) as StatusObject
          Object.assign(errorStatus.controller, {
            ready: false,
            error: true,
            errorData: {
              message: err
            }            
          } as Partial<ControllerStatus>)
          context.commit('setLastStatus', errorStatus)
          */
          void context.dispatch('clientStatus', client)
        });
      }, 500)
    }
  }
};

export default actions;
