import { GetterTree } from 'vuex';
import { StateInterface } from '../index';
import { TightCNCStateInterface } from './state';

const getters: GetterTree<TightCNCStateInterface, StateInterface> = {
  example( /*context*/) {
    // context....
  }
};

export default getters;
