import { ActionTree } from 'vuex';
import { StateInterface } from '../index';
import { DialogsStateInterface } from './state';

const actions: ActionTree<DialogsStateInterface, StateInterface> = {
  someAction (/* context */) {
    // your code
  }
};

export default actions;
