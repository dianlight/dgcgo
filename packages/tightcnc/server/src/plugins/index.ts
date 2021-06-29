import TightCNCServer from "../server/tightcnc-server";

import * as autolevel from './autolevel'
import * as moveSplitter from './move-splitter'
//import * as jobRecovery from './job-recovery'
import * as toolChange from './tool-change'
//import * as runtimeOverride from './runtime-override'

const pluginList:((tightcnc: TightCNCServer) => void)[] = [
	autolevel.registerServerComponents,
	moveSplitter.registerServerComponents,
	//jobRecovery,
	toolChange.registerServerComponents
	//, runtimeOverride
];

//const plugins = pluginList.map(async (reqName) => await import(`./${reqName}`));

export function registerServerComponents(tightcnc: TightCNCServer) {
	for (let plugin of pluginList) {
		plugin(tightcnc)
	}
};

/*
export function registerConsoleUIComponents(consoleui:ConsoleUI) {
	for (let plugin of plugins) {
		plugin.then( p => p.registerConsoleUIComponents(consoleui))
	}
};
*/
