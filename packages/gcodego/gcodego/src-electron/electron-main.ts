import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  dialog,
} from 'electron';
import path from 'path';
import fs from 'fs';
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer';
import log from 'electron-log';
import electron_cfg from 'electron-cfg';
import { autoUpdater } from 'electron-updater';
import yaml from 'yaml';
import { ChildProcess, fork } from 'child_process';
import portfinder from 'portfinder';
import { TightCNCConfig } from '@dianlight/tightcnc-core';
import { ElectronMenu } from './electron-menu'

try {
  if (
    process.platform === 'win32' &&
    nativeTheme.shouldUseDarkColors === true
  ) {
    fs.unlinkSync(path.join(app.getPath('userData'), 'DevTools Extensions'));
  }
} catch (_) { }

Object.assign(console, log.functions);
electron_cfg.logger(log);

//console.log(process.env)

const isDevelopment = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | undefined;


async function createWindow(): Promise<BrowserWindow> {
  const winCfg = electron_cfg.window({
    name: 'mainWindow',
    saveFullscreen: true,
    saveMaximize: true,
  });
  /**
   * Initial window options
   */
  return new Promise((resolve, reject) => {

    mainWindow = new BrowserWindow({
      width: 1000,
      height: 600,
      ...winCfg.options(),
      useContentSize: true,
      webPreferences: {
        contextIsolation: true,
        // More info: /quasar-cli/developing-electron-apps/electron-preload-script
        preload: path.resolve(
          __dirname,
          process.env.QUASAR_ELECTRON_PRELOAD as string
        ),
        devTools: process.env.DEBUGGING ? true : false,
        nodeIntegrationInWorker: true
      },
    });
    winCfg.assign(mainWindow);

    new ElectronMenu(mainWindow)

    void mainWindow.loadURL(process.env.APP_URL as string)
      .then(() => resolve(mainWindow as BrowserWindow))
      .catch (err=>reject(err))

    if (process.env.DEBUGGING) {
      // if on DEV or Production with debug enabled
      mainWindow.webContents.openDevTools();
    } else {
      // we're on production; no access to devtools pls
      mainWindow.webContents.on('devtools-opened', () => {
        mainWindow?.webContents.closeDevTools();
      });
    }

    mainWindow.on('closed', () => {
      mainWindow = undefined;
    });

    mainWindow.webContents.on('destroyed', () => {
      //console.error('-------------------------- Gone Request!');
      if (tightcnc && tightcnc.connected) {
        console.error('Tight Server PID ', tightcnc.pid);
        tightcnc?.kill();
      }
    });

    mainWindow.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(mainWindow as BrowserWindow, {
        type: 'question',
        buttons: ['Leave', 'Stay'],
        title: 'Do you want to leave this site?',
        message: 'Changes you made may not be saved.',
        defaultId: 0,
        cancelId: 1,
      });
      const leave = choice === 0;
      if (leave) {
        event.preventDefault();
      }
    });
  })
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e) {
      log.error('Vue Devtools failed to install:', JSON.stringify(e));
    }
  }
  //registerLocalResourceProtocol()
  //void createMenu()
  void createWindow()
  
  void autoUpdater.checkForUpdatesAndNotify();

  log.silly('Test Log from background.js', __filename);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    void createWindow();
  }
});

/** Open/Save Dialog */
// MacOs Specific
app.on('will-finish-launching', (/*event:any*/) => {
  app.on('open-file', (event, path) => {
    //    console.log("Richiesto openfile",path);
    mainWindow?.webContents.send('OpenEvent', [path]);
    event.preventDefault();
  });
  /*
    app.on("open-url", (event,path)=>{
        console.log("Richiesto openUrl",path);
        ipcMain.emit("open",[path])
    })
*/
});

/** Tight CNC Server */

//console.log(`TightCNC Path: ${require.resolve('@dianlight/tightcnc')}`)
//console.log(`Resouce Path is: "${process.resourcesPath}" "${__dirname}"`);
let tight_path = path.join(process.resourcesPath, 'tightcnc', 'server', 'bin', 'tightcnc-server.js')
if (!fs.existsSync(tight_path)) {
  tight_path = path.join(__dirname, '..', '..', '..', 'tightcnc', 'server', 'bin', 'tightcnc-server.js')
}

const tightcnc_conf = path.join(app.getPath('temp'), 'tightcnc.conf');

const tightcnc_env = Object.assign(process.env, {
  TIGHTCNC_CONFIG: tightcnc_conf,
});

let tightcnc: ChildProcess | undefined = undefined;
let serverPort = 0;
const host = 'http://localhost'

async function startTightCNC(_event: unknown, ...args: unknown[]) {
  const config: TightCNCConfig = args[0] as TightCNCConfig;
  if (!config.serverPort) {
    config.serverPort = await portfinder.getPortPromise();
    console.info(`Found Free TCP/Port ${config.serverPort}`);
  } else {
    console.info(`Use configured TCP/Port ${config.serverPort}`);
  }
  config.host = host

  return new Promise<{ pid?: number | undefined, host: string, serverPort: number, newInstance: boolean }>((resolve, reject) => {
    if (tightcnc && tightcnc.connected) {
      console.warn('Tight Server PID already running ', tightcnc.pid);
      resolve({ pid: tightcnc?.pid, host: host, serverPort: serverPort, newInstance: false });
    } else {
      console.log(tightcnc_env['TIGHTCNC_CONFIG']);

      // Setting basedit to AppData
      (args[0] as TightCNCConfig).baseDir = app.getPath('userData')
      console.log('TightCNC BaseDir:', (args[0] as TightCNCConfig).baseDir)

      fs.writeFileSync(tightcnc_conf, yaml.stringify(args[0]));
      //  const tightcnc = spawn(process.argv[0], [tight_path], {
      tightcnc = fork(tight_path, {
        env: tightcnc_env,
        silent: true,
        //    stdio: ['pipe','pipe', 'ipc']
      })
        .on('error', (error) => {
          console.error('TightCNC Error:', error);
          reject(error)
        })
        .on('close', (code) => {
          console.error('TightCNC Exit code', code);
          reject(new Error(`TightCNC Exit code ${code || 'None'}`))
        });

      tightcnc.stderr?.on('data', (data: Buffer) => {
        console.error('E:', data.toString());
      });

      tightcnc.stdout?.on('data', (data: Buffer) => {
        console.info('O', data.toString());
        if (data.toString().indexOf('Listening on port') >= 0) {
          resolve({ pid: tightcnc?.pid, host: host, serverPort: serverPort, newInstance: true });
        }
      });

      app.on('quit', () => {
        tightcnc?.kill('SIGTERM');
      });
      serverPort = config.serverPort;
    }
  })
}

ipcMain.handle('StartTightCNC', startTightCNC);

function stopTightCNC(/*_event, ..._args*/) {
  console.info('Killing TightCNC');
  tightcnc?.kill('SIGTERM');
  tightcnc = undefined;
  return;
}
ipcMain.handle('StopTightCNC', stopTightCNC);

ipcMain.on('SaveTightCNCConfig', (_event, ...args) => {
  //console.debug('Saving config', args[0]);
  electron_cfg.set('tightcnc.config', args[0]);

  return;
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
ipcMain.handle('LoadTightCNCConfig', (_event, ..._args) => {
  console.debug('Loading config...');
  return electron_cfg.get('tightcnc.config', {}) as Partial<TightCNCConfig>;
});
