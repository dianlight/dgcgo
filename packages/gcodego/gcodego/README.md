# GCode Go (gcodego)

A GCode sender and application. The aim of the project is to create a universal sender for cheap CNCs.

_The ambition of the project is the creation of a software like "Octoprint" for the world of CNC and also integrate a CAM part to lacorate directly from Gerber files (PCB factory) and SVG (laser works) etc etc._

<span style="color:red">**Warning!**</span>

<span style="color:red">_Development is currently in the early/prototype state. The software is not yet usable._</span>

## Why?

Since I decided to make my own PCBs for my pogetti I bought a Chinese CNC 1610 with grbl firmware. I immediately realized that unlike the world of 3D printers where semi-professional quality software are available for free in the world of CNC the situation is very different. Many software are dated and not optimized for new hardware and operating systems. Others lack of features as me necessary (like autolevel). There are specialized ones for Laser, Spindle but each one is missing something.

## Software I was inspired by

- Octoprint: I have been using it for years for my 3D prints as a "Gcode Sernder" and control center for my printer. Being able to make a CNC equivalent would be an accomplishment.

- bCNC: Great software for CNC control. Unfortunately the fact that it is written in python with an outdated graphical framework means that it can only run from a PC and not via the web like Octoprint. It also makes it difficult to install on non Intel/Windows architectures like my Apple M1.

- UGS: Nice software with several interesting features. Unfortunately it lacks a stable Autolevel so it's unusable in my case.

- FletCAM: Excellent CAM for the realization of PCB starting from Gerber design files. Lots of features but being written in Python/QT is difficult to install on MacOS in arm mode and is very unstable.

- Pcb2Gcode: Command line software for building PCBs from Gerber files. Very good functionality but it needs an adequate UI that runs also on non Intel/Windows architectures.

## Project scope

- [ ] Builder
  - [x] Patch package
  - [x] offline-github-changelog
  - [x] quasar icongenie
  - [ ] Automatic release (github)
- [ ] Quasar
  - [ ] inegrate better form creator ( blazier not yet compatible )
- [ ] Unit test
  - [ ] @quasar/testing ( not yet compatible )
    - [ ] spectrong integration
- [ ] Electron
  - [x] Electron-log
  - [x] Electron-cfg
  - [x] Electron-updater
  - [ ] Electron-default-Menu
    - [ ] Open gcode file dialog
      - [ ] Recent files / Dropin open file
    - [ ] Reexpose WebMenu functionalities
  - [x] ~~electron-icon-builder~~ ( Used Quasar icongeine)
  - [ ] electron-process-type
- [ ] WebServer version
  - [ ] Start/Stop scripts
  - [ ] Autoupdate support
  - [ ] Docker version
  - [ ] Rpi and other SBC support
    - [ ] Octopi like SD image (?)
- [x] Vue
  - [x] ~~Vue Auto router~~ ( unisefull )
  - [x] Vuei18n
    - [x] Dynamic loader
    - [x] Language switcher
  - [x] Vue3-gcode-viewer
  - [x] Dynamic Form ( temp solution )
- [ ] UI
  - [ ] Web Menu for non electron view (autohide?)
    - [ ] GCode upload
      - [ ] Gcode open for Electron based
    - [ ] Import/Export configuration
      - [ ] Import/Eport for Electron
  - [ ] Base Layout
    - [ ] Keyboard support
    - [ ] Remote Joystic / Joypad support
      - [ ] grbl offline controller
      - [ ] PS4 Joypad support
  - [ ] Status Widget
    - Machine / Work switch
  - [ ] Control Widget
    - [ ] Work 0 setting
    - [ ] Jog support
      - [ ] Web Remote control ( Mobile Phones on same network? )
        - [ ] QrCode based link
  - [ ] Autolever Widget
  - [ ] Probe Widget
    - [ ] Home
    - [ ] Z-Probe
    - [ ] Auto Zero Camera
  - [ ] Work control Widget
    - [ ] Suspend/Resume
    - [ ] Area scan/check
    - [ ] Tool change
      - [ ] M6 intercetp
      - [ ] Tool change Workflow
  - [ ] GCode viewer
    - [x] Basic Viewer
      - [x] G2/G3 Arch support
      - [x] Spindle position
      - [ ] UI view control
        - [ ] Reset/Center
        - [ ] Timeline visulaizer
          - [ ] Sync with work
- [ ] GCode Sender
  - [x] TightCNC vanilla integration
    - [x] Start / Stop external process
    - [ ] Electron packaged
    - [ ] Support GRBL
    - [ ] Support TinyG
  - [ ] TightCNC Fork/Extending
    - [ ] Typescript Types
    - [ ] Support for raw socket comunication
    - [ ] Support fro websocket comunication
    - [ ] Support start without config
    - [ ] Support for new API
      - [ ] Reload Config
      - [ ] Is Alive
    - [ ] Sender as Worker
      - [ ] Web-Serial/Web-USB API
      - [ ] support Virtual comunication API ( passtrought to Electron background process?)
    - [ ] More firmware
      - [ ] Support grblHal
      - [ ] Support Marlin

## Install the dependencies

```bash
yarn
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)

```bash
quasar dev
```

### Lint the files

```bash
yarn run lint
```

### Build the app for production

```bash
quasar build
```

### Customize the configuration

See [Configuring quasar.conf.js](https://v2.quasar.dev/quasar-cli/quasar-conf-js).
