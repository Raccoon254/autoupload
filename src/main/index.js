import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const axios = require('axios')
const chokidar = require('chokidar')
const path = require('path')
const FormData = require('form-data')
const fs = require('fs')

let mainWindow
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url).then((r) => {
      console.log('openExternal', r)
    })
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).then((r) => {
      console.log('loadURL', r)
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).then((r) => {
      console.log('loadFile', r)
    })
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron")

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const postFileToServer = (url, filePath, albumId, userId) => {
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`File ${filePath} does not exist`)
        return
      }

      const formData = new FormData()
      formData.append('filename', fs.createReadStream(filePath))
      formData.append('action', 'add') // Or 'remove', as appropriate
      formData.append('album_id', albumId)
      formData.append('user_id', userId)

      axios
        .post(url, formData, { headers: formData.getHeaders() })
        .then((response) => {
          console.log(response.data)
          mainWindow.webContents.send('upload-complete')
        })
        .catch((error) => {
          console.error(`Error in POST request: ${error}`);
          mainWindow.webContents.send('upload-complete')
        })
    })
  }

  ipcMain.on('upload', (event, { directory, albumId, userId }) => {
    const SERVER_URL = 'http://127.0.0.1:8000/api/upload'
    let filesToUpload = []

    const uploadFile = (filePath) => {
      console.log(`Uploading file: ${path.basename(filePath)}`)
      mainWindow.webContents.send('upload-status', `Uploading ${path.basename(filePath)}`) // Send current file name to renderer
      postFileToServer(SERVER_URL, filePath, albumId, userId, () => {
        filesToUpload = filesToUpload.filter((f) => f !== filePath) // Remove uploaded file from the list
        if (filesToUpload.length === 0) {
          mainWindow.webContents.send('upload-complete', 'All files uploaded successfully')
        }
      })
    }

    // Initialize watcher.
    const watcher = chokidar.watch(directory, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    })

    // Event listeners.
    watcher
      .on('add', (filePath) => {
        const extension = path.extname(filePath).toLowerCase()
        if (extension === '.png' || extension === '.jpg') {
          console.log(`File added: ${path.basename(filePath)}`)
          filesToUpload.push(filePath)
          uploadFile(filePath)
        }
      })
      .on('error', (error) => console.log(`Watcher error: ${error}`))

    setTimeout(() => {
      if (filesToUpload.length === 0) {
        mainWindow.webContents.send('upload-complete', 'No files to upload')
      }
    }, 5000)

    console.log(`Watching directory: ${directory}`)
  })

  ipcMain.on('login', async (event, credentials) => {
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/login', {
        email: credentials.username,
        password: credentials.password
      })

      console.log(credentials)

      if (response.data && !response.data.error) {
        event.reply('login-response', {
          success: true,
          message: 'Login Successful',
          user: response.data.user,
          albums: response.data.albums
        })
      } else {
        // If the data contains the 'error' key, authentication failed
        event.reply('login-response', { success: false, message: 'Login Failed' })
      }
    } catch (error) {
      event.reply('login-response', {
        success: false,
        message: 'Login Failed',
        error: error.message
      })
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
