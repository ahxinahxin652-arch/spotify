const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')

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
    titleBarOverlay: false,
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

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximized-changed', false)
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ========== Express 服务器 ==========
function startExpressServer() {
  const express = require('express')

  const expressApp = express()

  // 跨域
  expressApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') return res.sendStatus(200)
    next()
  })

  expressApp.use(express.json())

  // ---- 扫描目录下所有 flac 文件 ----
  expressApp.post('/api/scan-flac', (req, res) => {
    try {
      const { filePaths } = req.body
      if (!filePaths || !Array.isArray(filePaths)) {
        return res.json({ success: false, error: 'Invalid file paths' })
      }

      const flacFiles = []

      for (const filePath of filePaths) {
        const stats = fs.statSync(filePath)

        if (stats.isDirectory()) {
          // 递归扫描目录
          scanDir(filePath, flacFiles)
        } else if (stats.isFile()) {
          if (filePath.toLowerCase().endsWith('.flac')) {
            flacFiles.push({
              name: path.basename(filePath),
              path: filePath,
              size: stats.size,
            })
          }
        }
      }

      res.json({ success: true, files: flacFiles })
    } catch (err) {
      res.json({ success: false, error: err.message })
    }
  })

  // ---- 扫描目录（递归）----
  function scanDir(dir, result) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath, result)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.flac')) {
          const stats = fs.statSync(fullPath)
          result.push({
            name: entry.name,
            path: fullPath,
            size: stats.size,
          })
        }
      }
    } catch (e) {
      // 忽略无权限的目录
    }
  }

  // ---- 选择目录（通过 Electron 对话框）----
  expressApp.post('/api/select-directory', async (req, res) => {
    try {
      const { BrowserWindow } = require('electron')
      const { dialog } = require('electron')
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

  // ---- 开始转换 ----
  expressApp.post('/api/start-convert', async (req, res) => {
    const { files, outputPath } = req.body

    if (!files || !outputPath) {
      return res.json({ success: false, error: '缺少参数' })
    }

    // 验证输出目录
    if (!fs.existsSync(outputPath)) {
      return res.json({ success: false, error: '输出目录不存在' })
    }

    // 验证 ffmpeg
    const ffmpegPath = findFfmpeg()
    if (!ffmpegPath) {
      return res.json({ success: false, error: '未找到 ffmpeg，请确保已安装 ffmpeg 并添加到 PATH' })
    }

    res.json({ success: true, message: '转换开始' })

    // 异步执行转换
    processFiles(files, outputPath, ffmpegPath)
  })

  expressServer = expressApp.listen(EXPRESS_PORT, () => {
    console.log(`[Express] Server running on http://localhost:${EXPRESS_PORT}`)
  })
}

// ========== 查找 ffmpeg ==========
function findFfmpeg() {
  try {
    // 这行代码会自动返回内置 ffmpeg.exe 的绝对路径
    // 无论是开发环境，还是打包后的 exe 环境，它都能精准找到！
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

    // Electron 打包后，路径可能会变成 app.asar.unpacked，替换一下保证绝对能用
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  } catch (err) {
    console.error("无法加载内置的 FFmpeg", err);
    return null;
  }
}

// ========== 逐个转换文件 ==========
async function processFiles(files, outputPath, ffmpegPath) {
  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const inputFile = file.path
    const outputFile = path.join(outputPath, file.name.replace(/\.flac$/i, '.mp3'))

    sendProgress({
      type: 'file-progress',
      index: i,
      filename: file.name,
      progress: 0,
      totalProgress: Math.round((i / total) * 100),
    })

    try {
      await convertFile(ffmpegPath, inputFile, outputFile, (progress) => {
        const filePct = progress // 0-100
        const overall = Math.round(((i + filePct / 100) / total) * 100)
        sendProgress({
          type: 'file-progress',
          index: i,
          filename: file.name,
          progress: filePct,
          totalProgress: overall,
        })
      })

      sendProgress({
        type: 'file-done',
        index: i,
        filename: file.name,
        outputFile,
        totalProgress: Math.round(((i + 1) / total) * 100),
      })
    } catch (err) {
      sendProgress({
        type: 'error',
        index: i,
        filename: file.name,
        error: err.message,
      })
    }
  }

  sendProgress({
    type: 'all-done',
    total: total,
    outputPath,
  })
}

// ========== 单个文件转换（带进度） ==========
function convertFile(ffmpegPath, inputFile, outputFile, onProgress) {
  return new Promise((resolve, reject) => {
    const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/
    const timeRegex = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/

    let durationMs = 0
    let progressEmitted = 0

    const args = [
      '-i', inputFile,
      '-c:a', 'libmp3lame',
      '-b:a', '320k',
      '-ar', '48000',
      '-map_metadata', '0',
      // 注意：这里已经删除了 '-progress', 'pipe:1'
      '-y',
      outputFile,
    ]

    const ffmpeg = spawn(ffmpegPath, args, {
      shell: false,
    })

    ffmpeg.stdout.on('data', (data) => {
      const str = data.toString()

      // 解析总时长
      const durMatch = str.match(durationRegex)
      if (durMatch && durationMs === 0) {
        const h = parseInt(durMatch[1])
        const m = parseInt(durMatch[2])
        const s = parseInt(durMatch[3])
        const cs = parseInt(durMatch[4])
        durationMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
      }

      // 解析当前时间
      const timeMatch = str.match(timeRegex)
      if (timeMatch && durationMs > 0) {
        const h = parseInt(timeMatch[1])
        const m = parseInt(timeMatch[2])
        const s = parseInt(timeMatch[3])
        const cs = parseInt(timeMatch[4])
        const currentMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
        const pct = Math.min(100, Math.round((currentMs / durationMs) * 100))

        if (pct > progressEmitted) {
          progressEmitted = pct
          onProgress(pct)
        }
      }
    })

    ffmpeg.stderr.on('data', (data) => {
      const str = data.toString()
      // 解析总时长（ffmpeg 进度信息在 stderr）
      const durMatch = str.match(durationRegex)
      if (durMatch && durationMs === 0) {
        const h = parseInt(durMatch[1])
        const m = parseInt(durMatch[2])
        const s = parseInt(durMatch[3])
        const cs = parseInt(durMatch[4])
        durationMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
      }

      const timeMatch = str.match(timeRegex)
      if (timeMatch && durationMs > 0) {
        const h = parseInt(timeMatch[1])
        const m = parseInt(timeMatch[2])
        const s = parseInt(timeMatch[3])
        const cs = parseInt(timeMatch[4])
        const currentMs = ((h * 3600 + m * 60 + s) * 100 + cs) * 10
        const pct = Math.min(100, Math.round((currentMs / durationMs) * 100))

        if (pct > progressEmitted) {
          progressEmitted = pct
          onProgress(pct)
        }
      }
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`ffmpeg 进程退出，退出码: ${code}`))
      }
    })

    ffmpeg.on('error', (err) => {
      reject(new Error(`ffmpeg 启动失败: ${err.message}`))
    })
  })
}

// ========== 进度推送 ==========
function sendProgress(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('convert-progress', data)
  }
}

// ========== 窗口控制 IPC ==========
ipcControl('window-minimize', () => mainWindow.minimize())
ipcControl('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})
ipcControl('window-close', () => mainWindow.close())
ipcControl('window-is-maximized', () => mainWindow.isMaximized())

function ipcControl(channel, handler) {
  ipcMain.on(channel, () => {
    handler()
  })
}

// ========== 启动 ==========
app.whenReady().then(() => {
  startExpressServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (expressServer) expressServer.close()
  if (process.platform !== 'darwin') app.quit()
})