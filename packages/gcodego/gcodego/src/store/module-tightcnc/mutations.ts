import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import { ControllerStatus, StatusObject } from 'tightcnc'
//import { Client } from 'src/tightcnc/TightCNC';


const mutation: MutationTree<TightCNCStateInterface> = {
  setController(state: TightCNCStateInterface, controller: ControllerStatus) {
    if (state.lastStatus) {
      state.lastStatus.controller = controller
    }
  },
  setLastStatus(state: TightCNCStateInterface, status: StatusObject) {
    state.lastStatus = status
  },
};

export default mutation;