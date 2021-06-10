import { GetterTree } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';
import { ControllerCapabilities } from 'tightcnc'

const getters: GetterTree<TightCNCStateInterface, StateInterface> = {
  capabilities(context): ControllerCapabilities | undefined {
    if (context.lastStatus && context.lastStatus.controller) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return context.lastStatus.controller.capabilities;
    } else {
      return
    }
  }
};

export default getters;
