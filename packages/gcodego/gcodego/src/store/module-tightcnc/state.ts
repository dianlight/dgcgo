import { Client } from 'src/tightcnc/TightCNC';
import { StatusObject } from 'tightcnc'


export interface TightCNCStateInterface {
  client?: Client
  lastStatus?: StatusObject
}

function state(): TightCNCStateInterface {
  return {
    client: undefined,
    lastStatus: undefined
  }
};

export default state;