import { Module } from 'vuex';
import { StateInterface } from '../index';
import state, { TightCNCStateInterface } from './state';
import actions from './actions';
import getters from './getters';
import mutations from './mutations';

const tightcncModule: Module<TightCNCStateInterface, StateInterface> = {
  namespaced: true,
  actions,
  getters,
  mutations,
  state
};

export default tightcncModule;
