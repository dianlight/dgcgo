import {TightCNCClient,StatusObject} from 'tightcnc'


export interface TightCNCStateInterface {
  client?: TightCNCClient
  lastStatus?: StatusObject
}

function state(): TightCNCStateInterface {
  return {
    client: undefined,
    lastStatus: undefined
  }
};

export default state;
