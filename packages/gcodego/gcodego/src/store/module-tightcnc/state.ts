import * as TightCNC from '../../tightcnc/TightCNC'


export interface TightCNCStateInterface {
  client?: TightCNC.Client
  lastStatus?: TightCNC.Status
}

function state(): TightCNCStateInterface {
  return {
    client: undefined,
    lastStatus: undefined
  }
};

export default state;
