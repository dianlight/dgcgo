import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import log from 'electron-log'
import electron_cfg from 'electron-cfg'
import { autoUpdater } from 'electron-updater'

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