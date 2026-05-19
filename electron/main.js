const express = require('express')
const { ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const { app, BrowserWindow, dialog, Tray, Menu, nativeImage } = require('electron')
const ApiResult = require('../server/pojo/vo/ApiResult')

let mainWindow = null
let tray = null
let isQuitting = false
let expressServer = null
const EXPRESS_PORT = 3000

// ========== 系统托盘 ==========
function createTray() {
  // 使用 nativeImage 创建一个简单的托盘图标（16x16 紫色圆角方块 + 音符符号）
  const size = 16
  const canvas = Buffer.alloc(size * size * 4) // RGBA

  // 绘制一个紫色背景的圆形图标
  const centerX = 7.5
  const centerY = 7.5
  const radius = 7
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4

      if (dist <= radius) {
        // 紫色 #863bff
        canvas[idx] = 0x86       // R
        canvas[idx + 1] = 0x3b   // G
        canvas[idx + 2] = 0xff   // B
        canvas[idx + 3] = 0xff   // A
      } else {
        // 透明
        canvas[idx] = 0
        canvas[idx + 1] = 0
        canvas[idx + 2] = 0
        canvas[idx + 3] = 0
      }
    }
  }

  const icon = nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
  })
  // macOS 需要 template image
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('Satisfy')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'open Satisfy',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'exit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 双击托盘图标显示窗口（Windows）
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

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

  // 关键：点击关闭按钮时隐藏到托盘，而不是关闭窗口
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      // Windows: 可选显示通知
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'Spotify',
          content: '应用已最小化到系统托盘',
          icon: nativeImage.createFromBuffer(Buffer.alloc(1)), // 使用默认图标
        })
      }
    }
  })

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

  // ---- 音乐仓库 API (所有 music 路由已改为 async) ----
  const musicService = require('../server/service/musicService')

  expressApp.get('/api/music/warehouses', async (req, res) => {
    const sortBy = req.query.sortBy || 'recent-played'
    res.json(await musicService.getMusicWarehouses(sortBy))
  })

  expressApp.post('/api/music/warehouses', async (req, res) => {
    const { name } = req.body
    res.json(await musicService.createMusicWarehouse(name))
  })

  expressApp.put('/api/music/warehouses/:name', async (req, res) => {
    const { name } = req.params
    const updates = req.body
    res.json(await musicService.updateMusicWarehouse(decodeURIComponent(name), updates))
  })

  expressApp.delete('/api/music/warehouses/:name', async (req, res) => {
    const { name } = req.params
    res.json(await musicService.deleteMusicWarehouse(decodeURIComponent(name)))
  })

  expressApp.get('/api/music/warehouses/:name/tracks', async (req, res) => {
    const { name } = req.params
    res.json(await musicService.getWarehouseTracks(decodeURIComponent(name)))
  })

  expressApp.post('/api/music/warehouses/:name/import', async (req, res) => {
    const { name } = req.params
    const { filePaths } = req.body
    res.json(await musicService.importFilesToWarehouse(decodeURIComponent(name), filePaths))
  })

  expressApp.get('/api/music/warehouse-dir', (req, res) => {
    res.json(ApiResult.ok({ path: musicService.getMusicWarehouseDir() }))
  })

  // 校验曲目是否可播放（播放前调用，文件不存在则自动清理数据库）
  expressApp.post('/api/music/validate-track', async (req, res) => {
    const { trackId, filePath } = req.body
    res.json(await musicService.validateTrackPlayable(trackId, filePath))
  })

  // 同步音乐库（文件系统 <-> 数据库一致性）
  expressApp.post('/api/music/warehouses/:name/sync', async (req, res) => {
    const { name } = req.params
    res.json(await musicService.syncWarehouse(decodeURIComponent(name)))
  })

  // 更新最近播放时间（播放歌曲时调用）
  expressApp.post('/api/music/warehouses/:name/recent-played', async (req, res) => {
    const { name } = req.params
    res.json(await musicService.updateRecentPlayed(decodeURIComponent(name)))
  })

  // 通过 ID 更新最近播放时间（名称变更安全）
  expressApp.post('/api/music/libraries/:id/recent-played', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.updateRecentPlayedById(decodeURIComponent(id)))
  })

  // 通过 track ID 解析当前最新的 track 信息（含最新 path，播放前调用）
  expressApp.get('/api/music/tracks/:id', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.resolveTrackById(decodeURIComponent(id)))
  })

  // 更新曲目信息（编辑歌曲）
  expressApp.put('/api/music/tracks/:id', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.updateTrack(decodeURIComponent(id), req.body))
  })

  // 删除曲目
  expressApp.delete('/api/music/tracks/:id', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.deleteTrack(decodeURIComponent(id)))
  })

  // ---- 以下是 ID-based 的仓库操作 ----

  // 通过 library ID 获取曲目列表
  expressApp.get('/api/music/libraries/:id/tracks', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.getWarehouseTracksById(decodeURIComponent(id)))
  })

  // 通过 library ID 导入文件
  expressApp.post('/api/music/libraries/:id/import', async (req, res) => {
    const { id } = req.params
    const { filePaths } = req.body
    res.json(await musicService.importFilesToWarehouseById(decodeURIComponent(id), filePaths))
  })

  // 通过 library ID 同步音乐库
  expressApp.post('/api/music/libraries/:id/sync', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.syncWarehouseById(decodeURIComponent(id)))
  })

  // 通过 library ID 删除音乐库
  expressApp.delete('/api/music/libraries/:id', async (req, res) => {
    const { id } = req.params
    res.json(await musicService.deleteMusicWarehouseById(decodeURIComponent(id)))
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
      return res.json(ApiResult.fail('缺少参数'))
    }

    const ffmpegPath = convertDao.getFfmpegPath()
    if (!ffmpegPath) {
      return res.json(ApiResult.fail('未找到 ffmpeg，请确保已安装'))
    }

    if (!fs.existsSync(outputPath)) {
      return res.json(ApiResult.fail('输出目录不存在'))
    }

    res.json(ApiResult.ok(null, '转换开始'))

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
        return res.json(ApiResult.fail('已取消'))
      }
      res.json(ApiResult.ok({ path: result.filePaths[0] }))
    } catch (err) {
      res.json(ApiResult.fail(err.message))
    }
  })

  // ---- 音乐解密 API ----
  const decryptDao = require('../server/dao/decryptDao')
  const decryptService = require('../server/service/decryptService')

  expressApp.get('/api/decrypt/formats', (req, res) => {
    res.json(decryptService.getSupportedFormats())
  })

  expressApp.post('/api/decrypt/scan', (req, res) => {
    const { filePaths } = req.body
    res.json(decryptService.scanDecryptFiles(filePaths))
  })

  expressApp.post('/api/decrypt/file', async (req, res) => {
    const { inputPath, outputPath, outputFormat } = req.body
    const result = await decryptService.decryptFile(inputPath, outputPath, outputFormat || 'mp3')
    res.json(result)
  })

  expressApp.post('/api/decrypt/start', async (req, res) => {
    const { files, outputPath } = req.body
    if (!files || !outputPath) {
      return res.json(ApiResult.fail('缺少参数'))
    }

    if (!fs.existsSync(outputPath)) {
      return res.json(ApiResult.fail('输出目录不存在'))
    }

    res.json(ApiResult.ok(null, '解密开始'))

    await decryptService.startDecrypt(files, outputPath, (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('decrypt-progress', data)
      }
    })
  })

  expressApp.post('/api/decrypt/select-directory', async (req, res) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择输出目录',
      })
      if (result.canceled) {
        return res.json(ApiResult.fail('已取消'))
      }
      res.json(ApiResult.ok({ path: result.filePaths[0] }))
    } catch (err) {
      res.json(ApiResult.fail(err.message))
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

  // 选择文件，处理前端选择音乐文件的请求
  ipcMain.handle('dialog:selectMusicFiles', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: '选择音频文件',
        filters: [
          {
            name: '音频文件',
            extensions: ['flac', 'mp3', 'ogg', 'wav', 'aac', 'm4a', 'kgm', 'kgma', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm']
          },
        ],
      })
      if (result.canceled) {
        return []
      }
      return result.filePaths
    } catch (err) {
      console.error('打开文件管理器失败:', err)
      return []
    }
  })

  // 读取文件为 ArrayBuffer
  ipcMain.on('read-file', (event, { key, filePath }) => {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        event.reply('read-file-result', { key, error: '文件不存在或已被删除' })
        return
      }
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
const { initDatabase, autoMigrate, autoRecoverFromFiles, disconnectDatabase } = require('../server/dao/db')

app.whenReady().then(async () => {
  // 1. 初始化数据库
  initDatabase()

  // 2. 自动执行建表迁移（确保运行时数据库表结构存在）
  await autoMigrate()

  // 3. 自动恢复：数据库为空时从已有文件夹重建
  await autoRecoverFromFiles()

  // 3. 启动 Express 服务器
  startExpressServer()

  // 4. 创建系统托盘
  createTray()

  // 5. 创建窗口
  createWindow()

  // 6. 设置 IPC
  setupWindowControls()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

// 真正退出时的清理
app.on('before-quit', async () => {
  isQuitting = true
  await disconnectDatabase()
  if (expressServer) expressServer.close()
  if (tray) tray.destroy()
})

app.on('window-all-closed', () => {
  // 不退出：窗口关闭只是隐藏到托盘，isQuitting 才是真正退出
  if (process.platform === 'darwin' && !isQuitting) {
    // macOS: 应用不会因为窗口关闭而退出，这行实际不会执行
  }
})
