import { GetterTree } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';

const getters: GetterTree<TightCNCStateInterface, StateInterface> = {
  someAction (/* context */) {
    // your code
  }
};

export default getters;
