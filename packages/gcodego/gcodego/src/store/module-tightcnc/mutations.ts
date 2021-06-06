import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import {TightCNCClient,StatusObject} from 'tightcnc'


const mutation: MutationTree<TightCNCStateInterface> = {
  setClient (state: TightCNCStateInterface, client:TightCNCClient) {
    state.client = client
  },
  setLastStatus(state: TightCNCStateInterface, status: StatusObject) {
    state.lastStatus = status
  }
};

export default mutation;
