import { GetterTree } from 'vuex';
import { StateInterface } from '../index';
import { DialogsStateInterface } from './state';

const getters: GetterTree<DialogsStateInterface, StateInterface> = {
  someGetter (/* context */) {
    // your code
  }
};

export default getters;
