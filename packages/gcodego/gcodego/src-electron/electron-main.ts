import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import log from 'electron-log'
import electron_cfg from 'electron-cfg'
import { autoUpdater } from 'electron-updater'
import yaml from 'yaml'
import { ChildProcess, fork } from 'child_process';

try {
    if (process.platform === 'win32' && nativeTheme.shouldUseDarkColors === true) {
        fs.unlinkSync(path.join(app.getPath('userData'), 'DevTools Extensions'))
    }
} catch (_) {}


Object.assign(console, log.functions);
electron_cfg.logger(log)

console.log(process.env)

const isDevelopment = process.env.NODE_ENV !== 'production'

let mainWindow: BrowserWindow | undefined

async function createWindow() {
    const winCfg = electron_cfg.window({
        name: 'mainWindow',
        saveFullscreen: true,
        saveMaximize: true
    });
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        ...winCfg.options(),
        useContentSize: true,
        webPreferences: {
            contextIsolation: true,
            // More info: /quasar-cli/developing-electron-apps/electron-preload-script
            preload: path.resolve(__dirname, process.env.QUASAR_ELECTRON_PRELOAD as string)
        }
    })
    winCfg.assign(mainWindow)

    await mainWindow.loadURL(process.env.APP_URL as string)

    if (process.env.DEBUGGING) {
        // if on DEV or Production with debug enabled
        mainWindow.webContents.openDevTools()
    } else {
        // we're on production; no access to devtools pls
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow?.webContents.closeDevTools()
        })
    }

    mainWindow.on('closed', () => {
        mainWindow = undefined
    })
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.on('ready',async () => {
    if (isDevelopment && !process.env.IS_TEST) {
        // Install Vue Devtools
        try {
            await installExtension(VUEJS3_DEVTOOLS)
        } catch (e) {
            log.error('Vue Devtools failed to install:', JSON.stringify(e))
        }
    }
    //registerLocalResourceProtocol()
    //void createMenu()
    void createWindow()
    void autoUpdater.checkForUpdatesAndNotify()

    log.silly('Test Log from background.js', __filename)
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        void createWindow()
    }
})

/** Tight CNC Server */
const tight_path = path.join(__dirname,'..', 'node_modules', 'tightcnc', 'bin', 'tightcnc-server.js');

const tightcnc_conf = path.join(app.getPath('temp'), 'tightcnc.conf');

const tightcnc_env = Object.assign(process.env, {
  'TIGHTCNC_CONFIG': tightcnc_conf
});

let tightcnc: ChildProcess | undefined = undefined;

ipcMain.handle('StartTightCNC', (event, ...args) => {
   if (tightcnc) {
       console.error('Tight Server PID already running ', tightcnc.pid);
       return tightcnc.pid;
   } 
  console.log(tightcnc_env['TIGHTCNC_CONFIG']);
  //  console.log("0",typeof args[0], yaml.stringify(args[0]));
  //  console.log("1",typeof args[1], args[1]);
  fs.writeFileSync(tightcnc_conf, yaml.stringify(args[0]));
  //  const tightcnc = spawn(process.argv[0], [tight_path], {
  tightcnc = fork(tight_path, {
    env: tightcnc_env,
    silent: true,
    //    stdio: ['pipe','pipe', 'ipc']
  }).on('error', (error) => {
    console.error('TightCNC Error:', error);
  }).on('close', (code) => {
      const newLocal = 'TightCNC Exit code'
    console.error(newLocal, code);
  });

  tightcnc.stderr?.on('data', (data: Buffer) => {
    console.error('E:', data.toString());
  });

  tightcnc.stdout?.on('data', (data: Buffer) => {
    console.info('O', data.toString());
  });

  app.on('quit', () => {
    tightcnc?.kill('SIGTERM');
  });

  return tightcnc.pid;
})

ipcMain.handle('StopTightCNC', (_event, ..._args) => {
    tightcnc?.kill('SIGTERM');
    return 
})