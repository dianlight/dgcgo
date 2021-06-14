export interface DialogsStateInterface {
  preferences: boolean;
}

function state(): DialogsStateInterface {
  return {
    preferences: false,
  };
}

export default state;
