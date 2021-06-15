import { MutationTree } from 'vuex';
import { TightCNCStateInterface } from './state';
import { ControllerStatus, StatusObject, JobStatus } from 'tightcnc'


const mutation: MutationTree<TightCNCStateInterface> = {
  setController(state: TightCNCStateInterface, controller: ControllerStatus) {
    if (state.lastStatus) {
      state.lastStatus.controller = controller
    }
  },
  setLastStatus(state: TightCNCStateInterface, status: StatusObject) {
    state.lastStatus = status
  },
  setJobStatus(state: TightCNCStateInterface, status: Partial<JobStatus>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    state.jobStatus = status
  },

};

export default mutation;