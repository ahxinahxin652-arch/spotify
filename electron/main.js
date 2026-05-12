const express = require('express')
const { ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const { app, BrowserWindow, dialog } = require('electron')

let mainWindow = null
let expressServer = null
const EXPRESS_PORT = 3000

// ========== 窗口管理 ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d0e11',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  })

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized-changed', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized-changed', false))

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

// ========== Express 服务器 ==========
function startExpressServer() {
  const expressApp = express()

  // 跨域
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
  })

  expressApp.use(express.json({ limit: '500mb' }))
  expressApp.use(express.urlencoded({ extended: true, limit: '500mb' }))

  // ---- 音乐仓库 API ----
  const musicDao = require('../server/dao/musicDao')
  const musicService = require('../server/service/musicService')

  expressApp.get('/api/music/warehouses', (req, res) => {
    res.json(musicService.getMusicWarehouses())
  })

  expressApp.post('/api/music/warehouses', (req, res) => {
    const { name } = req.body
    res.json(musicService.createMusicWarehouse(name))
  })

  expressApp.delete('/api/music/warehouses/:name', (req, res) => {
    const { name } = req.params
    res.json(musicService.deleteMusicWarehouse(decodeURIComponent(name)))
  })

  expressApp.get('/api/music/warehouses/:name/tracks', (req, res) => {
    const { name } = req.params
    res.json(musicService.getWarehouseTracks(decodeURIComponent(name)))
  })

  expressApp.post('/api/music/warehouses/:name/import', (req, res) => {
    const { name } = req.params
    const { filePaths } = req.body
    res.json(musicService.importFilesToWarehouse(decodeURIComponent(name), filePaths))
  })

  expressApp.get('/api/music/warehouse-dir', (req, res) => {
    res.json({ success: true, path: musicService.getMusicWarehouseDir() })
  })

  // ---- 格式转换 API ----
  const convertDao = require('../server/dao/convertDao')
  const convertService = require('../server/service/convertService')

  expressApp.post('/api/convert/scan', (req, res) => {
    const { filePaths } = req.body
    res.json(convertService.scanFlacFiles(filePaths))
  })

  expressApp.post('/api/convert/start', async (req, res) => {
    const { files, outputPath } = req.body
    if (!files || !outputPath) {
      return res.json({ success: false, error: '缺少参数' })
    }

    const ffmpegPath = convertDao.getFfmpegPath()
    if (!ffmpegPath) {
      return res.json({ success: false, error: '未找到 ffmpeg，请确保已安装' })
    }

    if (!fs.existsSync(outputPath)) {
      return res.json({ success: false, error: '输出目录不存在' })
    }

    res.json({ success: true, message: '转换开始' })

    await convertService.startConvert(files, outputPath, (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('convert-progress', data)
      }
    })
  })

  expressApp.post('/api/convert/select-directory', async (req, res) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择输出目录',
      })
      if (result.canceled) {
        return res.json({ success: false, canceled: true })
      }
      res.json({ success: true, path: result.filePaths[0] })
    } catch (err) {
      res.json({ success: false, error: err.message })
    }
  })

  // ---- 音乐解密 API ----
  const decryptDao = require('../server/dao/decryptDao')
  const decryptService = require('../server/service/decryptService')

  expressApp.get('/api/decrypt/formats', (req, res) => {
    res.json(decryptService.getSupportedFormats())
  })

  expressApp.post('/api/decrypt/file', async (req, res) => {
    const { inputPath, outputPath, outputFormat } = req.body
    const result = await decryptService.decryptFile(inputPath, outputPath, outputFormat || 'mp3')
    res.json(result)
  })

  expressApp.post('/api/decrypt/select-directory', async (req, res) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择输出目录',
      })
      if (result.canceled) {
        return res.json({ success: false, canceled: true })
      }
      res.json({ success: true, path: result.filePaths[0] })
    } catch (err) {
      res.json({ success: false, error: err.message })
    }
  })

  expressServer = expressApp.listen(EXPRESS_PORT, () => {
    console.log(`[Express] Server running on http://localhost:${EXPRESS_PORT}`)
  })
}

// ========== 窗口控制 IPC ==========
function setupWindowControls() {
  ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window-close', () => mainWindow && mainWindow.close())

  // 读取文件为 ArrayBuffer
  ipcMain.on('read-file', (event, { key, filePath }) => {
    try {
      const buffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap = {
        '.flac': 'audio/flac',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.aac': 'audio/aac',
        '.m4a': 'audio/mp4',
      }
      event.reply('read-file-result', {
        key,
        buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        mimeType: mimeMap[ext] || 'application/octet-stream',
      })
    } catch (err) {
      event.reply('read-file-result', { key, error: err.message })
    }
  })
}

// ========== 启动 ==========
app.whenReady().then(() => {
  startExpressServer()
  createWindow()
  setupWindowControls()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (expressServer) expressServer.close()
  if (process.platform !== 'darwin') app.quit()
})