import { MutationTree } from 'vuex';
import { DialogsStateInterface } from './state';

const mutation: MutationTree<DialogsStateInterface> = {
  showDialog ( state: DialogsStateInterface, dialog: keyof DialogsStateInterface ) {
    state[dialog]=true
  },
  hideDialog ( state: DialogsStateInterface, dialog: keyof DialogsStateInterface ) {
    state[dialog]=false
  }
};

export default mutation;
