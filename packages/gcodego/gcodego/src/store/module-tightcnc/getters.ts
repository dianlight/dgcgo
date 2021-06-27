import { GetterTree } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';
import { ControllerCapabilities } from '@dianlight/tightcnc'

const getters: GetterTree<TightCNCStateInterface, StateInterface> = {
  capabilities(context): ControllerCapabilities | undefined {
    if (context.lastStatus && context.lastStatus.controller) {
      return context.lastStatus.controller.capabilities;
    } else {
      return
    }
  }
};

export default getters;
