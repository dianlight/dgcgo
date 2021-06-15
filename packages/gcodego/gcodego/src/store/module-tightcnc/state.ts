import { StatusObject,JobStatus } from 'tightcnc'


export interface TightCNCStateInterface {
  lastStatus?: StatusObject
  jobStatus:Partial<JobStatus>
}

function state(): TightCNCStateInterface {
  return {
    lastStatus: undefined,
    jobStatus: {}
  }
};

export default state;
