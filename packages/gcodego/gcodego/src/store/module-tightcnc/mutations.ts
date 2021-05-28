import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import * as TightCNC from '../../tightcnc/TightCNC'


const mutation: MutationTree<TightCNCStateInterface> = {
  setClient (state: TightCNCStateInterface, client:TightCNC.Client) {
    state.client = client
  },
  setLastStatus(state: TightCNCStateInterface, status: TightCNC.Status) {
    state.lastStatus = status
  }
};

export default mutation;
