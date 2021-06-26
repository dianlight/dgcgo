import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  dialog,
  shell,
  Menu,
} from 'electron';
import path from 'path';
import fs from 'fs';
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer';
import log from 'electron-log';
import electron_cfg from 'electron-cfg';
import { autoUpdater } from 'electron-updater';
import yaml from 'yaml';
import { ChildProcess, fork } from 'child_process';
import findFreePorts from 'find-free-ports';
import { TightCNCConfig } from 'tightcnc';
import defaultMenu from 'electron-default-menu';
import {
  MenuItemConstructorOptions,
  OpenDialogReturnValue,
} from 'electron/main';

try {
  if (
    process.platform === 'win32' &&
    nativeTheme.shouldUseDarkColors === true
  ) {
    fs.unlinkSync(path.join(app.getPath('userData'), 'DevTools Extensions'));
  }
} catch (_) {}

Object.assign(console, log.functions);
electron_cfg.logger(log);

//console.log(process.env)

const isDevelopment = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | undefined;

function createMenu(i18n: (path: string) => string) {
  const menu = defaultMenu(app, shell);

  const isMac = process.platform === 'darwin';

  // Preferencies on Mac
  if (isMac) {
    (menu[0]?.submenu as Electron.MenuItemConstructorOptions[]).splice(
      2,
      0,
      {
        label: i18n('preferences'),
        //            label: 'Preferencies',
        click: () =>
          mainWindow?.webContents.send('MenuEvent', { dialog: 'preferences' }),
      },
      {
        type: 'separator',
      }
    );
  }

  // Add File menu
  menu.splice(1, 0, {
    role: 'fileMenu',
    submenu: [
      /*
            {
                label: i18n('file.newProject'), / * click: () => store.dispatch('new')* /
            },
            {
                label: i18n('file.newProjectFrom'),
                submenu: [
                    { label: i18n('file.gerberFolder'), enabled: false },
                    {
                        label: i18n('file.gerberZip'), / * click:()=>store.dispatch('openGerberZip')* /
                    },
                ]
            },
            { type: 'separator' },
            */
      {
        label: i18n('file.open'),
        click: async () => {
          if (!mainWindow) await createWindow();
          void dialog
            .showOpenDialog(mainWindow as BrowserWindow, {
              title: i18n('open.title'),
              filters: [
                {
                  name: 'All supported',
                  extensions: ['gcode', 'nc', 'ncc', 'cnc'],
                },
                { name: 'GCode', extensions: ['gcode', 'nc', 'ncc'] },
                { name: 'Centroid', extensions: ['cnc'] },
              ],
              properties: ['openFile', 'multiSelections'],
            })
            .then((value: OpenDialogReturnValue) => {
              if (!value.canceled) {
                value.filePaths.forEach((path) => {
                  mainWindow?.webContents.send(
                    'OpenEvent',
                    {
                      filaname: path,
                      gcode: fs.readFileSync(path).toLocaleString()
                    }
                  );
                });
              }
            });
        },
      },
      ...(isMac
        ? [
            {
              role: 'recentDocuments',
              submenu: [
                { type: 'separator' },
                { role: 'clearRecentDocuments' },
              ],
            } as MenuItemConstructorOptions,
          ]
        : []),
      /*
            { type: 'separator' },
            { id: 'save', label: i18n('menu.file.save'),/ * click:()=>store.dispatch('save'),* / enabled: false },
            { label: i18n('menu.file.saveAs'),/ * click:()=>store.dispatch('saveAs')* / },
            { type: 'separator' },
            { id: 'import', label: i18n('menu.file.import'), / *click:()=>store.dispatch('importGerber'),* / enabled: false },
            { type: 'separator' },
            { id: 'close', label: i18n('menu.file.closeProject'),/* click:()=>store.dispatch('close'),* / enabled: false },
            */
      ...(isMac
        ? []
        : [
            { type: 'separator' } as MenuItemConstructorOptions,
            {
              label: i18n('menu.app.preferencies'),
              click: () =>
                mainWindow?.webContents.send('MenuEvent', {
                    dialog: 'preferences',
                }),
            } as MenuItemConstructorOptions,
          ]),
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  });

  // Custom View menu
  (menu[3]?.submenu as Electron.MenuItemConstructorOptions[]).push(
    /*
    { type: 'separator' },
    {
      label: i18n('menu.view.workbench'),
      click: () =>
        mainWindow?.webContents.send('MenuEvent', { link: '/workbench' }),
    },
    */
    { type: 'separator' },
    {
      label: i18n('menu.view.terminal'),
      click: () =>
        mainWindow?.webContents.send('MenuEvent', { link: '/terminal' }),
    }
  );

  // Add custom menu
  menu.splice(4, 0, {
    label: i18n('menu.action'),
    submenu: [
      {
        label: 'Restart TightCNC server',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        click: (item, focusedWindow) => {
          mainWindow?.webContents.send('MenuEvent', { command: 'restartTightCNC' }),
          void dialog.showMessageBox({
            message: 'TightCNC restarting',
            buttons: ['OK'],
          });
        },
      },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

async function createWindow() {
  const winCfg = electron_cfg.window({
    name: 'mainWindow',
    saveFullscreen: true,
    saveMaximize: true,
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
      preload: path.resolve(
        __dirname,
        process.env.QUASAR_ELECTRON_PRELOAD as string
      ),
      devTools: process.env.DEBUGGING ? true : false,
      nodeIntegrationInWorker: true
    },
  });
  winCfg.assign(mainWindow);

  await mainWindow.loadURL(process.env.APP_URL as string);

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
  void createWindow();
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

/** Application Menu */
ipcMain.on('PopulateApplicationMenu', (_event, ...args) => {
  //console.debug('Popupating Menu', args[0]);
  createMenu((path: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const tr = path.split('.').reduce<any>((prev, curr) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      if (prev === undefined) return prev;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const elem = prev[curr];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return elem 
    }, args[0]);
    if (tr) return tr as string;
    else return path;
  });
});

/** Tight CNC Server */

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

async function startTightCNC(_event: unknown, ...args:unknown[]) {
  const config: TightCNCConfig = args[0] as TightCNCConfig;
  if (!config.serverPort) {
       [config.serverPort] = await findFreePorts(1);
      console.info(`Found Free TCP/Port ${config.serverPort}`);
  } else {
      console.info(`Use configured TCP/Port ${config.serverPort}`);
  }
  config.host = host

  return new Promise<{ pid?: number, host:string, serverPort: number,newInstance:boolean }>((resolve, reject) => {
    if (tightcnc && tightcnc.connected) {
      console.warn('Tight Server PID already running ', tightcnc.pid);
      resolve({ pid: tightcnc?.pid,host:host, serverPort: serverPort,newInstance:false });
    } else {
      console.log(tightcnc_env['TIGHTCNC_CONFIG']);

      // Setting basedit to AppData
      (args[0] as TightCNCConfig).baseDir = app.getPath('userData')
      console.log('TightCNC BaseDir:',(args[0] as TightCNCConfig).baseDir)

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
          const newLocal = 'TightCNC Exit code';
          console.error(newLocal, code);
        });

      tightcnc.stderr?.on('data', (data: Buffer) => {
        console.error('E:', data.toString());
      });

      tightcnc.stdout?.on('data', (data: Buffer) => {
        console.info('O', data.toString());
        if (data.toString().indexOf('Listening on port') >= 0) {
            resolve({ pid: tightcnc?.pid,host: host, serverPort: serverPort,newInstance:true });
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
ipcMain.handle('StopTightCNC', stopTightCNC );

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
