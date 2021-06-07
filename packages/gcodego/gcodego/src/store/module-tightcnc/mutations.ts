import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import { StatusObject } from 'tightcnc'
import { Client } from 'src/tightcnc/TightCNC';


const mutation: MutationTree<TightCNCStateInterface> = {
  setClient (state: TightCNCStateInterface, client:Client) {
    state.client = client
  },
  setLastStatus(state: TightCNCStateInterface, status: StatusObject) {
    state.lastStatus = status
  },
};

export default mutation;