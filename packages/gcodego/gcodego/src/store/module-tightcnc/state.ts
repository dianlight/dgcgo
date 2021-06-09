import { StatusObject } from 'tightcnc'


export interface TightCNCStateInterface {
  lastStatus?: StatusObject
}

function state(): TightCNCStateInterface {
  return {
    lastStatus: undefined
  }
};

export default state;
