import defaultMenu from 'electron-default-menu';
import {
    MenuItemConstructorOptions,
    OpenDialogReturnValue,
} from 'electron/main';
import {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    shell,
    Menu,
} from 'electron';
import fs from 'fs';
import * as _ from 'lodash'



export class ElectronMenu {

    menu: Electron.MenuItemConstructorOptions[]

    constructor(public mainWindow: BrowserWindow) {

        this.menu = defaultMenu(app, shell);

        const isMac = process.platform === 'darwin';

        /** Static Menu */
        // Preferencies on Mac
        if (isMac) {
            (this.menu[0]?.submenu as Electron.MenuItemConstructorOptions[]).splice(
                2,
                0,
                {
                    label:'menu.preferences',
                    //            label: 'Preferencies',
                    click: () =>
                        this.mainWindow?.webContents.send('MenuEvent', { dialog: 'preferences' }),
                },
                {
                    type: 'separator',
                }
            );
        }

        // Add File menu
        this.menu.splice(1, 0, {
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
                    label: 'menu.file.open',
                    click: async () => {
                        //if (!this.mainWindow) await createWindow();
                        void dialog
                            .showOpenDialog(this.mainWindow, {
                             //   title: i18n('open.title'),
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
                                        this.mainWindow?.webContents.send(
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
                            label: 'menu.preferences',
                            click: () =>
                                this.mainWindow?.webContents.send('MenuEvent', {
                                    dialog: 'preferences',
                                }),
                        } as MenuItemConstructorOptions,
                    ]),
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        });

        // Custom View menu
        (this.menu[3]?.submenu as Electron.MenuItemConstructorOptions[]).push(
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
                label: 'menu.view.terminal',
                click: () =>
                    this.mainWindow?.webContents.send('MenuEvent', { link: '/terminal' }),
            }
        );

        // Add custom menu
        this.menu.splice(4, 0, {
            label: 'menu.action',
            submenu: [
                {
                    label: 'Restart TightCNC server',
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    click: (item, focusedWindow) => {
                        this.mainWindow?.webContents.send('MenuEvent', { command: 'restartTightCNC' }),
                            void dialog.showMessageBox({
                                message: 'TightCNC restarting',
                                buttons: ['OK'],
                            });
                    },
                },
            ],
        });


        /** Application Menu */
        ipcMain.on('PopulateApplicationMenu', (_event, ...args) => {
            //console.debug('Popupating Menu', args[0]);
            this.createMenu((path: string) => {
                //console.log(path)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                const tr = path.split('.').reduce<any>((prev, curr) => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    if (prev === undefined || curr === 'menu') return prev;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    const elem = prev[curr];
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return elem
                }, args[0]);
                if (tr) return tr as string;
                else return path;
            });
        });

        ipcMain.on('AddMenu', (_event, ...args) => {
            //console.log('AddMenu',args[0])
            const link = args[0] as { menu: string /*'menu.view.autolevel'*/, to: string /*'/autolevel'*/, icon?: string /*'level'*/, tooltip?: string /*'AutoLevel'*/ }
            const menuPath = link.menu.split('.')
            if (menuPath[0] === 'menu' && menuPath.length > 2) {
                //console.log('Is A Menu!', menuPath)
                this.menu.forEach(cmenu => {
                    console.log(menuPath[1],cmenu.role,cmenu.label)
                    if (cmenu.role === menuPath[1] || cmenu.label?.toLowerCase() === menuPath[1].toLowerCase()) {
                        (cmenu.submenu as Electron.MenuItemConstructorOptions[]).push(
                            {
                                label: link.menu,
                                click: () =>
                                    this.mainWindow?.webContents.send('MenuEvent', { link: link.to }),
                            }
                        )
                    }
                })
            }

        });

        ipcMain.on('DelMenu', (_event, ...args) => {
            //console.log('DelMenu',args[0])
            const menuPath = (args[0] as string).split('.')
            if (menuPath[0] === 'menu' && menuPath.length > 2) {
                this.menu.forEach(cmenu => {
                    if (cmenu.role === menuPath[1] || cmenu.label?.toLowerCase() === menuPath[1].toLowerCase()) {
                        (cmenu.submenu as Electron.MenuItemConstructorOptions[]) = (cmenu.submenu as Electron.MenuItemConstructorOptions[])
                            .filter(sm => sm.label !== args[0])
                    }
                })
            }
        });

    }

    applyI18N(i18n: (path: string) => string,menu:Electron.MenuItemConstructorOptions[]){
        menu.forEach(menu => {
            if (menu.label) menu.label = i18n(menu.label)
            if (menu.submenu) {
                this.applyI18N(i18n,menu.submenu as Electron.MenuItemConstructorOptions[])
            }
        });
    }

    createMenu(i18n: (path: string) => string) {

        // Translate The Menu
        const realMenu = _.cloneDeep(this.menu)
        this.applyI18N(i18n,realMenu)

        Menu.setApplicationMenu(Menu.buildFromTemplate(realMenu));
    }




}

